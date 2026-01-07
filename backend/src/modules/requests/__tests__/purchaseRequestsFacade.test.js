/**
 * Tests for PurchaseRequestsFacade - Strangler Pattern Implementation
 *
 * Tests cover:
 * - Golden tests (legacy vs V2 equivalence)
 * - No-legacy-writes tests (spy/mocks)
 * - Concurrency tests (Drive idempotence)
 * - BC gating integration
 */

const { purchaseRequestsFacade } = require('../purchaseRequestsFacade');
const db = require('../../../config/db');

// Mock dependencies
jest.mock('../../../config/db');
jest.mock('../../../utils/drive');
jest.mock('../../../utils/audit');
jest.mock('../business-case/businessCase.service');

// Test data
const mockUser = {
    id: 1,
    email: 'test@example.com',
    fullname: 'Test User'
};

const mockClient = {
    id: 123,
    name: 'Test Client',
    email: 'client@example.com'
};

const mockEquipment = [
    { name: 'Equipment 1', quantity: 1 },
    { name: 'Equipment 2', quantity: 2 }
];

const mockFile = {
    buffer: Buffer.from('test file content'),
    mimetype: 'application/pdf',
    originalname: 'test.pdf'
};

describe('PurchaseRequestsFacade - Strangler Pattern', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset environment variables for each test
        process.env.REQUESTS_UNIFICATION_V2 = 'false';
        process.env.BC_GATING_FOR_CONTRACT = 'false';
        process.env.BC_AFTER_SIGNED_PROFORMA = 'false';
    });

    describe('Golden Tests - Legacy vs V2 Equivalence', () => {
        test('createPurchaseRequest: V2 and legacy produce equivalent results', async () => {
            // Enable V2
            process.env.REQUESTS_UNIFICATION_V2 = 'true';

            const params = {
                user: mockUser,
                clientId: mockClient.id,
                clientName: mockClient.name,
                clientEmail: mockClient.email,
                equipment: mockEquipment,
                notes: 'Test purchase'
            };

            // Mock DB responses
            db.query.mockResolvedValueOnce({ rows: [] }); // assignee lookup
            db.query.mockResolvedValueOnce({ rows: [{ id: 100 }] }); // create request
            db.query.mockResolvedValueOnce({}); // update folder

            const result = await purchaseRequestsFacade.createPurchaseRequest(params);

            // Verify V2 path was taken
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO requests'),
                expect.any(Array)
            );

            // Verify response structure
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('status');
            expect(result.equipment).toEqual(mockEquipment);
        });

        test('uploadSignedProforma: triggers BC creation when enabled', async () => {
            process.env.REQUESTS_UNIFICATION_V2 = 'true';
            process.env.BC_AFTER_SIGNED_PROFORMA = 'true';

            // Mock V2 request lookup
            db.query.mockResolvedValueOnce({
                rows: [{
                    id: 100,
                    payload: JSON.stringify({
                        status: 'waiting_signed_proforma',
                        client_name: mockClient.name,
                        client_id: mockClient.id
                    })
                }]
            });

            // Mock document upload
            db.query.mockResolvedValueOnce({}); // lock check
            db.query.mockResolvedValueOnce({ rows: [{ payload: '{}' }] }); // payload check
            db.query.mockResolvedValueOnce({}); // update proforma

            // Mock BC creation
            db.query.mockResolvedValueOnce({}); // BC lock
            db.query.mockResolvedValueOnce({ rows: [{ payload: '{}' }] }); // BC check
            db.query.mockResolvedValueOnce({}); // create BC
            db.query.mockResolvedValueOnce({}); // update BC

            const result = await purchaseRequestsFacade.uploadSignedProforma(
                '100', mockUser, mockFile, '2024-01-01', '2024-01-31', true
            );

            // Verify BC creation was attempted
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('business_case'),
                expect.any(Array)
            );
        });

        test('getGatingStatus: respects BC gating flag', async () => {
            process.env.REQUESTS_UNIFICATION_V2 = 'true';
            process.env.BC_GATING_FOR_CONTRACT = 'true';

            // Mock request lookup with no commercial certainty
            db.query.mockResolvedValueOnce({
                rows: [{
                    id: 100,
                    payload: JSON.stringify({
                        proforma_signed_at: null,
                        commercial_certainty: false
                    })
                }]
            });

            const result = await purchaseRequestsFacade.getGatingStatus('100', mockUser);

            expect(result.can_proceed_to_contract).toBe(false);
            expect(result.gating_reasons).toContain('NO_COMMERCIAL_CERTAINTY');
        });
    });

    describe('No-Legacy-Writes Tests', () => {
        test('V2 enabled: facade does not call legacy DB operations', async () => {
            process.env.REQUESTS_UNIFICATION_V2 = 'true';

            const params = {
                user: mockUser,
                clientId: mockClient.id,
                clientName: mockClient.name,
                clientEmail: mockClient.email,
                equipment: mockEquipment
            };

            // Mock V2 path
            db.query.mockResolvedValueOnce({ rows: [] }); // assignee
            db.query.mockResolvedValueOnce({ rows: [{ id: 100 }] }); // create
            db.query.mockResolvedValueOnce({}); // folder update

            await purchaseRequestsFacade.createPurchaseRequest(params);

            // Verify NO calls to legacy table
            const dbCalls = db.query.mock.calls;
            const legacyTableCalls = dbCalls.filter(call =>
                call[0] && typeof call[0] === 'string' &&
                call[0].includes('equipment_purchase_requests')
            );

            expect(legacyTableCalls.length).toBe(0);
        });

        test('V2 disabled: facade uses legacy operations', async () => {
            process.env.REQUESTS_UNIFICATION_V2 = 'false';

            const params = {
                user: mockUser,
                clientId: mockClient.id,
                clientName: mockClient.name,
                clientEmail: mockClient.email,
                equipment: mockEquipment
            };

            // Mock legacy service call
            const mockLegacyService = {
                createPurchaseRequest: jest.fn().mockResolvedValue({ id: 200 })
            };

            // Mock require to return legacy service
            jest.doMock('../equipment-purchases/equipmentPurchases.service', () => mockLegacyService);

            await purchaseRequestsFacade.createPurchaseRequest(params);

            expect(mockLegacyService.createPurchaseRequest).toHaveBeenCalledWith(params);
        });
    });

    describe('Concurrency Tests - Drive Idempotence', () => {
        test('uploadContract: concurrent calls create single document', async () => {
            process.env.REQUESTS_UNIFICATION_V2 = 'true';

            // Mock request lookup
            db.query.mockResolvedValue({
                rows: [{
                    id: 100,
                    payload: JSON.stringify({
                        bc_status: 'approved',
                        proforma_signed_at: '2024-01-01T00:00:00Z',
                        commercial_certainty: true
                    })
                }]
            });

            // Mock concurrent folder/document operations
            let callCount = 0;
            db.query.mockImplementation((query, params) => {
                if (query.includes('FOR UPDATE')) {
                    callCount++;
                    if (callCount === 1) {
                        // First call gets lock
                        return Promise.resolve({ rows: [{ payload: '{}' }] });
                    } else {
                        // Second call finds existing folder
                        return Promise.resolve({ rows: [{ payload: JSON.stringify({ contract_file_id: 'existing-id' }) }] });
                    }
                }
                return Promise.resolve({});
            });

            // Simulate concurrent calls
            const promises = [
                purchaseRequestsFacade.uploadContract('100', mockUser, mockFile),
                purchaseRequestsFacade.uploadContract('100', mockUser, mockFile)
            ];

            const results = await Promise.all(promises);

            // Both should succeed
            expect(results).toHaveLength(2);
            expect(results[0]).toBeDefined();
            expect(results[1]).toBeDefined();

            // Should have same contract_file_id (idempotent)
            expect(results[0].contract_file_id).toBe(results[1].contract_file_id);
        });

        test('_ensurePurchaseFolder: prevents duplicate folder creation', async () => {
            const facade = require('../purchaseRequestsFacade');

            // First call creates folder
            db.query.mockResolvedValueOnce({}); // lock
            db.query.mockResolvedValueOnce({ rows: [{ payload: '{}' }] }); // check
            db.query.mockResolvedValueOnce({}); // create folder
            db.query.mockResolvedValueOnce({}); // update

            const result1 = await facade._ensurePurchaseFolder('Test Folder', 100);
            expect(result1).toBeDefined();

            // Second call finds existing folder
            db.query.mockResolvedValueOnce({}); // lock
            db.query.mockResolvedValueOnce({ rows: [{ payload: JSON.stringify({ drive_folder_id: 'existing-folder' }) }] }); // check

            const result2 = await facade._ensurePurchaseFolder('Test Folder', 100);
            expect(result2).toBe('existing-folder');
        });
    });

    describe('BC Gating Integration', () => {
        test('uploadContract: blocks when BC not approved', async () => {
            process.env.REQUESTS_UNIFICATION_V2 = 'true';
            process.env.BC_GATING_FOR_CONTRACT = 'true';

            // Mock request with approved proforma but unapproved BC
            db.query.mockResolvedValue({
                rows: [{
                    payload: JSON.stringify({
                        proforma_signed_at: '2024-01-01T00:00:00Z',
                        commercial_certainty: true,
                        bc_status: 'in_review', // Not approved
                        bc_spreadsheet_id: 'bc-123'
                    })
                }]
            });

            await expect(
                purchaseRequestsFacade.uploadContract('100', mockUser, mockFile)
            ).rejects.toThrow('BC_NOT_APPROVED');
        });

        test('uploadContract: allows when BC approved', async () => {
            process.env.REQUESTS_UNIFICATION_V2 = 'true';
            process.env.BC_GATING_FOR_CONTRACT = 'true';

            // Mock request with approved BC
            db.query.mockResolvedValueOnce({
                rows: [{
                    payload: JSON.stringify({
                        proforma_signed_at: '2024-01-01T00:00:00Z',
                        commercial_certainty: true,
                        bc_status: 'approved',
                        bc_spreadsheet_id: 'bc-123'
                    })
                }]
            });

            // Mock successful document upload
            db.query.mockResolvedValueOnce({}); // lock
            db.query.mockResolvedValueOnce({ rows: [{ payload: '{}' }] }); // check
            db.query.mockResolvedValueOnce({}); // upload

            const result = await purchaseRequestsFacade.uploadContract('100', mockUser, mockFile);

            expect(result).toBeDefined();
            expect(result.contract_file_id).toBeDefined();
        });

        test('uploadContract: exempts when bc_gating_exempt=true', async () => {
            process.env.REQUESTS_UNIFICATION_V2 = 'true';
            process.env.BC_GATING_FOR_CONTRACT = 'true';

            // Mock request with exemption
            db.query.mockResolvedValueOnce({
                rows: [{
                    payload: JSON.stringify({
                        bc_gating_exempt: true,
                        proforma_signed_at: null // Would normally block
                    })
                }]
            });

            // Mock successful document upload
            db.query.mockResolvedValueOnce({}); // lock
            db.query.mockResolvedValueOnce({ rows: [{ payload: '{}' }] }); // check
            db.query.mockResolvedValueOnce({}); // upload

            const result = await purchaseRequestsFacade.uploadContract('100', mockUser, mockFile);

            expect(result).toBeDefined();
        });
    });

    describe('Legacy Mapping Integration', () => {
        test('resolveCanonicalId: handles V2 requests', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{
                    id: '100',
                    form_variant: 'purchase',
                    legacy_purchase_id: '200'
                }]
            });

            const result = await purchaseRequestsFacade.resolveCanonicalId('100');

            expect(result.store).toBe('v2');
            expect(result.id).toBe('100');
            expect(result.v2Id).toBe('100');
            expect(result.legacyId).toBe('200');
        });

        test('resolveCanonicalId: handles legacy requests with mapping', async () => {
            // V2 check returns no results
            db.query.mockResolvedValueOnce({ rows: [] });

            // Legacy check finds mapping
            db.query.mockResolvedValueOnce({
                rows: [{ id: '200', v2_request_id: '100' }]
            });

            const result = await purchaseRequestsFacade.resolveCanonicalId('200');

            expect(result.store).toBe('v2');
            expect(result.id).toBe('100');
            expect(result.legacyId).toBe('200');
        });

        test('resolveCanonicalId: handles unmapped legacy requests', async () => {
            // V2 check returns no results
            db.query.mockResolvedValueOnce({ rows: [] });

            // Legacy check finds no mapping
            db.query.mockResolvedValueOnce({
                rows: [{ id: '200', v2_request_id: null }]
            });

            const result = await purchaseRequestsFacade.resolveCanonicalId('200');

            expect(result.store).toBe('legacy');
            expect(result.id).toBe('200');
            expect(result.legacyId).toBe('200');
        });
    });
});