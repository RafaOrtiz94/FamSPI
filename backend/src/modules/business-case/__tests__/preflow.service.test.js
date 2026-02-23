jest.mock('../../../config/db', () => ({
  query: jest.fn(),
}));
jest.mock('../../equipment-purchases/equipmentPurchases.service', () => ({
  createPurchaseRequest: jest.fn(),
}));
jest.mock('../../private-purchases/privatePurchases.service', () => ({
  createPurchaseRequest: jest.fn(),
}));
jest.mock('../businessCase.service', () => ({
  getBusinessCaseById: jest.fn(),
}));
jest.mock('../businessCaseDataOwnership', () => ({
  BusinessCaseDataOwnership: {
    getOwnershipInfo: jest.fn(),
  },
}));
jest.mock('../../notifications/notificationManager', () => ({
  sendNotification: jest.fn(),
}));

const preflow = require('../businessCasePreflow.service');

describe('businessCasePreflow.service', () => {
  it('buildPreflowInfo calcula progreso y serverNow', () => {
    const bc = {
      bc_purchase_type: 'public',
      modern_bc_metadata: {
        preflow_enabled: true,
        preflow_required_sections: ['general', 'lab'],
        preflow_deadline_at: '2099-01-01T00:00:00.000Z',
      },
    };

    const info = preflow.buildPreflowInfo(
      bc,
      { general: { isCompleted: true }, lab: { isCompleted: false } },
      new Date('2026-01-01T00:00:00.000Z'),
    );

    expect(info.isActive).toBe(true);
    expect(info.requiredSections).toEqual(['general', 'lab']);
    expect(info.completedRequiredSections).toEqual(['general']);
    expect(info.readyToStartProcess).toBe(false);
    expect(info.serverNow).toBe('2026-01-01T00:00:00.000Z');
  });

  it('isPreflowCase reconoce private_comodato', () => {
    expect(preflow.isPreflowCase({ bc_purchase_type: 'private_comodato' })).toBe(true);
  });
});
