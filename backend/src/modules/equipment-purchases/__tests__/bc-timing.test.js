/**
 * BC Timing Feature Tests
 *
 * Tests for Business Case creation timing after signed proforma
 */

const { createPurchaseRequest, uploadSignedProforma, updateBusinessCaseFields } = require('../equipmentPurchases.service');
const db = require('../../../config/db');

// Mock dependencies
jest.mock('../../../config/db');
jest.mock('../../../utils/drive');
jest.mock('../../../utils/calendar');
jest.mock('../../../utils/mailer');
jest.mock('../inventario/inventario.service');
jest.mock('../notifications/notificationManager');
jest.mock('../business-case/businessCase.service');
jest.mock('../requests/requests.service');

describe('Business Case Timing Feature', () => {
    const mockUser = {
        id: 1,
        email: 'test@example.com',
        role: 'acp_comercial'
    };

    const mockClient = {
        id: 1,
        name: 'Test Client',
        client_email: 'client@example.com'
    };

    const mockEquipment = [{
        id: 'equip1',
        name: 'Test Equipment',
        sku: 'TEST001',
        type: 'new'
    }];

    beforeEach(() => {
        jest.clearAllMocks();
        // Set feature flag for tests
        process.env.BC_AFTER_SIGNED_PROFORMA = 'true';
    });

    afterEach(() => {
        // Reset feature flag
        delete process.env.BC_AFTER_SIGNED_PROFORMA;
    });

    describe('createPurchaseRequest', () => {
        it('should NOT create BC immediately when feature flag is enabled', async () => {
            // Arrange
            const mockDbResponse = {
                rows: [{
                    id: 'test-uuid',
                    client_name: mockClient.name,
                    status: 'pending_provider_assignment',
                    bc_spreadsheet_id: null
                }]
            };

            db.query.mockResolvedValueOnce(mockDbResponse);
            db.query.mockResolvedValueOnce({ rows: [mockClient] });

            // Act
            const result = await createPurchaseRequest({
                user: mockUser,
                clientId: mockClient.id,
                clientName: mockClient.name,
                clientEmail: mockClient.client_email,
                assignedTo: mockUser.id,
                equipment: mockEquipment,
                notes: 'Test request'
            });

            // Assert
            expect(result.bc_spreadsheet_id).toBeNull();
            expect(result.bc_created_reason).toBeUndefined();
        });
    });

    describe('uploadSignedProforma', () => {
        it('should create BC and set commercial certainty when feature flag is enabled', async () => {
            // Arrange
            const mockRequest = {
                id: 'test-uuid',
                status: 'waiting_signed_proforma',
                client_id: mockClient.id,
                drive_folder_id: 'folder123',
                provider_email: 'provider@example.com',
                bc_spreadsheet_id: null,
                equipment: JSON.stringify(mockEquipment),
                provider_response: { items: mockEquipment.map(eq => ({ ...eq, decision: 'accept', available_type: 'new' })) }
            };

            const mockFile = {
                buffer: Buffer.from('test file'),
                originalname: 'signed_proforma.pdf',
                mimetype: 'application/pdf'
            };

            // Mock database queries
            db.query
                .mockResolvedValueOnce({ rows: [mockRequest] }) // getById
                .mockResolvedValueOnce({ rows: [mockClient] }) // getClientDetails
                .mockResolvedValueOnce({ rows: [{ id: 'file123' }] }) // uploadDocument
                .mockResolvedValueOnce({ rows: [{ id: 'file124' }] }) // sendAndArchive
                .mockResolvedValueOnce({ rows: [mockRequest] }) // update query
                .mockResolvedValueOnce({ rows: [mockClient] }); // getClientDetails again

            // Act
            const result = await uploadSignedProforma({
                id: mockRequest.id,
                user: mockUser,
                file: mockFile,
                inspection_min_date: '2024-01-15',
                inspection_max_date: '2024-01-20',
                includes_starter_kit: true
            });

            // Assert
            expect(result.proforma_signed_at).toBeDefined();
            expect(result.commercial_certainty).toBe(true);
            expect(result.bc_created_reason).toBe('signed_proforma');
            expect(result.bc_locked_until_signed).toBe(false);
        });

        it('should NOT recreate BC if already exists', async () => {
            // Arrange
            const mockRequest = {
                id: 'test-uuid',
                status: 'waiting_signed_proforma',
                client_id: mockClient.id,
                drive_folder_id: 'folder123',
                provider_email: 'provider@example.com',
                bc_spreadsheet_id: 'existing_bc_123', // BC already exists
                equipment: JSON.stringify(mockEquipment),
                provider_response: { items: mockEquipment.map(eq => ({ ...eq, decision: 'accept', available_type: 'new' })) }
            };

            const mockFile = {
                buffer: Buffer.from('test file'),
                originalname: 'signed_proforma.pdf',
                mimetype: 'application/pdf'
            };

            db.query
                .mockResolvedValueOnce({ rows: [mockRequest] }) // getById
                .mockResolvedValueOnce({ rows: [mockClient] }) // getClientDetails
                .mockResolvedValueOnce({ rows: [{ id: 'file123' }] }) // uploadDocument
                .mockResolvedValueOnce({ rows: [{ id: 'file124' }] }) // sendAndArchive
                .mockResolvedValueOnce({ rows: [mockRequest] }); // update query

            // Act
            const result = await uploadSignedProforma({
                id: mockRequest.id,
                user: mockUser,
                file: mockFile,
                inspection_min_date: '2024-01-15',
                inspection_max_date: '2024-01-20',
                includes_starter_kit: true
            });

            // Assert
            expect(result.bc_spreadsheet_id).toBe('existing_bc_123'); // Should remain unchanged
            expect(result.proforma_signed_at).toBeDefined();
            expect(result.commercial_certainty).toBe(true);
        });
    });

    describe('updateBusinessCaseFields', () => {
        it('should BLOCK BC editing when commercial certainty is missing', async () => {
            // Arrange
            const mockRequest = {
                id: 'test-uuid',
                proforma_signed_at: null,
                commercial_certainty: false,
                bc_locked_until_signed: false
            };

            db.query.mockResolvedValueOnce({ rows: [mockRequest] }); // getById

            // Act & Assert
            await expect(updateBusinessCaseFields({
                id: mockRequest.id,
                user: mockUser,
                fields: { 'Test Field': 'Test Value' }
            })).rejects.toThrow('No se puede editar el Business Case hasta que se suba la proforma firmada');
        });

        it('should BLOCK editing of legacy BCs created before signed proforma', async () => {
            // Arrange
            const mockRequest = {
                id: 'test-uuid',
                proforma_signed_at: null,
                commercial_certainty: false,
                bc_locked_until_signed: true // Legacy BC
            };

            db.query.mockResolvedValueOnce({ rows: [mockRequest] }); // getById

            // Act & Assert
            await expect(updateBusinessCaseFields({
                id: mockRequest.id,
                user: mockUser,
                fields: { 'Test Field': 'Test Value' }
            })).rejects.toThrow('Este Business Case fue creado antes de la proforma firmada y está bloqueado para edición');
        });

        it('should ALLOW BC editing when commercial certainty exists', async () => {
            // Arrange
            const mockRequest = {
                id: 'test-uuid',
                proforma_signed_at: new Date(),
                commercial_certainty: true,
                bc_locked_until_signed: false,
                bc_spreadsheet_id: 'sheet123',
                client_id: mockClient.id
            };

            db.query
                .mockResolvedValueOnce({ rows: [mockRequest] }) // getById
                .mockResolvedValueOnce({ rows: [mockClient] }) // getClientDetails
                .mockResolvedValueOnce({ rows: [mockRequest] }) // ensureBusinessCaseDocument
                .mockResolvedValueOnce({ rows: [mockRequest] }); // final update

            // Act
            const result = await updateBusinessCaseFields({
                id: mockRequest.id,
                user: mockUser,
                fields: { 'Test Field': 'Test Value' }
            });

            // Assert
            expect(result).toBeDefined();
        });
    });

    describe('assertPurchaseCanProceedToContract', () => {
        beforeEach(() => {
            process.env.BC_GATING_FOR_CONTRACT = 'true';
        });

        afterEach(() => {
            delete process.env.BC_GATING_FOR_CONTRACT;
        });

        it('should ALLOW contract upload when all conditions are met', async () => {
            // Arrange
            const mockRequest = {
                id: 'test-uuid',
                proforma_signed_at: new Date(),
                commercial_certainty: true,
                bc_spreadsheet_id: 'sheet123',
                bc_status: 'approved',
                bc_gating_exempt: false
            };

            db.query.mockResolvedValueOnce({ rows: [mockRequest] });

            // Act
            const result = await service.assertPurchaseCanProceedToContract('test-uuid', mockUser);

            // Assert
            expect(result.canProceed).toBe(true);
            expect(result.reasons).toEqual([]);
        });

        it('should BLOCK contract upload when proforma not signed', async () => {
            // Arrange
            const mockRequest = {
                id: 'test-uuid',
                proforma_signed_at: null,
                commercial_certainty: false,
                bc_spreadsheet_id: 'sheet123',
                bc_status: 'approved',
                bc_gating_exempt: false
            };

            db.query.mockResolvedValueOnce({ rows: [mockRequest] });

            // Act & Assert
            await expect(service.assertPurchaseCanProceedToContract('test-uuid', mockUser))
                .rejects.toThrow('Se requiere proforma firmada para proceder con el contrato');
        });

        it('should BLOCK contract upload when BC not created', async () => {
            // Arrange
            const mockRequest = {
                id: 'test-uuid',
                proforma_signed_at: new Date(),
                commercial_certainty: true,
                bc_spreadsheet_id: null,
                bc_status: 'not_created',
                bc_gating_exempt: false
            };

            db.query.mockResolvedValueOnce({ rows: [mockRequest] });

            // Act & Assert
            await expect(service.assertPurchaseCanProceedToContract('test-uuid', mockUser))
                .rejects.toThrow('Se requiere Business Case aprobado para proceder con el contrato');
        });

        it('should BLOCK contract upload when BC not approved', async () => {
            // Arrange
            const mockRequest = {
                id: 'test-uuid',
                proforma_signed_at: new Date(),
                commercial_certainty: true,
                bc_spreadsheet_id: 'sheet123',
                bc_status: 'in_review',
                bc_gating_exempt: false
            };

            db.query.mockResolvedValueOnce({ rows: [mockRequest] });

            // Act & Assert
            await expect(service.assertPurchaseCanProceedToContract('test-uuid', mockUser))
                .rejects.toThrow('El Business Case debe estar aprobado para proceder con el contrato');
        });

        it('should ALLOW contract upload for legacy exempt records', async () => {
            // Arrange
            const mockRequest = {
                id: 'test-uuid',
                proforma_signed_at: null,
                commercial_certainty: false,
                bc_spreadsheet_id: 'sheet123',
                bc_status: 'draft',
                bc_gating_exempt: true
            };

            db.query.mockResolvedValueOnce({ rows: [mockRequest] });

            // Act
            const result = await service.assertPurchaseCanProceedToContract('test-uuid', mockUser);

            // Assert
            expect(result.canProceed).toBe(true);
            expect(result.exempt).toBe(true);
        });

        it('should BLOCK contract upload when user lacks role', async () => {
            // Arrange
            const mockRequest = {
                id: 'test-uuid',
                proforma_signed_at: new Date(),
                commercial_certainty: true,
                bc_spreadsheet_id: 'sheet123',
                bc_status: 'approved',
                bc_gating_exempt: false
            };

            const unauthorizedUser = { ...mockUser, role: 'comercial' };
            db.query.mockResolvedValueOnce({ rows: [mockRequest] });

            // Act & Assert
            await expect(service.assertPurchaseCanProceedToContract('test-uuid', unauthorizedUser))
                .rejects.toThrow('Usuario no autorizado para subir contratos');
        });
    });

    describe('submitBusinessCaseForApproval', () => {
        it('should submit BC for approval when prerequisites are met', async () => {
            // Arrange
            const mockRequest = {
                id: 'test-uuid',
                bc_spreadsheet_id: 'sheet123',
                bc_status: 'draft'
            };

            db.query
                .mockResolvedValueOnce({ rows: [mockRequest] }) // getById
                .mockResolvedValueOnce({ rows: [mockRequest] }); // update

            // Act
            const result = await service.submitBusinessCaseForApproval('test-uuid', mockUser);

            // Assert
            expect(result.bc_status).toBe('in_review');
            expect(result.bc_submitted_at).toBeDefined();
            expect(result.bc_submitted_by).toBe(mockUser.id);
        });

        it('should BLOCK submission when proforma not signed', async () => {
            // Arrange
            const mockRequest = {
                id: 'test-uuid',
                proforma_signed_at: null,
                commercial_certainty: false,
                bc_spreadsheet_id: 'sheet123',
                bc_status: 'draft'
            };

            db.query.mockResolvedValueOnce({ rows: [mockRequest] });

            // Act & Assert
            await expect(service.submitBusinessCaseForApproval('test-uuid', mockUser))
                .rejects.toThrow('Se requiere proforma firmada para enviar BC a aprobación');
        });
    });

    describe('approveBusinessCase', () => {
        it('should approve BC when user has correct role', async () => {
            // Arrange
            const approverUser = { ...mockUser, role: 'gerencia' };
            const mockRequest = {
                id: 'test-uuid',
                bc_spreadsheet_id: 'sheet123',
                bc_status: 'in_review'
            };

            db.query
                .mockResolvedValueOnce({ rows: [mockRequest] }) // getById
                .mockResolvedValueOnce({ rows: [mockRequest] }); // update

            // Act
            const result = await service.approveBusinessCase('test-uuid', approverUser);

            // Assert
            expect(result.bc_status).toBe('approved');
            expect(result.bc_approved_at).toBeDefined();
            expect(result.bc_approved_by).toBe(approverUser.id);
        });

        it('should BLOCK approval when user lacks role', async () => {
            // Arrange
            const mockRequest = {
                id: 'test-uuid',
                bc_spreadsheet_id: 'sheet123',
                bc_status: 'in_review'
            };

            db.query.mockResolvedValueOnce({ rows: [mockRequest] });

            // Act & Assert
            await expect(service.approveBusinessCase('test-uuid', mockUser))
                .rejects.toThrow('Usuario no autorizado para aprobar Business Cases');
        });
    });

    describe('getPurchaseGatingStatus', () => {
        beforeEach(() => {
            process.env.BC_GATING_FOR_CONTRACT = 'true';
        });

        afterEach(() => {
            delete process.env.BC_GATING_FOR_CONTRACT;
        });

        it('should return gating status with reasons', async () => {
            // Arrange
            const mockRequest = {
                id: 'test-uuid',
                proforma_signed_at: null,
                commercial_certainty: false,
                bc_spreadsheet_id: null,
                bc_status: 'not_created',
                bc_gating_exempt: false
            };

            db.query.mockResolvedValueOnce({ rows: [mockRequest] });

            // Act
            const result = await service.getPurchaseGatingStatus('test-uuid', mockUser);

            // Assert
            expect(result.can_proceed_to_contract).toBe(false);
            expect(result.gating_reasons).toEqual(['NO_COMMERCIAL_CERTAINTY', 'BC_NOT_CREATED']);
            expect(result.exempt).toBe(false);
        });

        it('should return exempt status for legacy records', async () => {
            // Arrange
            const mockRequest = {
                id: 'test-uuid',
                bc_gating_exempt: true
            };

            db.query.mockResolvedValueOnce({ rows: [mockRequest] });

            // Act
            const result = await service.getPurchaseGatingStatus('test-uuid', mockUser);

            // Assert
            expect(result.can_proceed_to_contract).toBe(true);
            expect(result.exempt).toBe(true);
        });
    });
});
