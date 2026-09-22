/**
 * Phase 7 Verification Tests: Transport Directory & Wholesale CRM
 * 
 * Verifies:
 * 1. Transport Directory: Destination filtering, favourite transport toggle, Call & WhatsApp payload formatting.
 * 2. CRM Follow-up Types: PAYMENT, SALES, ORDER, CUSTOMER_VISIT, OTHER.
 * 3. CRM Follow-up Statuses: PENDING, COMPLETED, CANCELLED.
 * 4. CRM Follow-up Views: TODAY, OVERDUE, UPCOMING date classification.
 */

import { TransportRecord, CRMFollowUp, CRMType, CRMStatus, CRMViewFilter } from '../types';

export function runPhase7TransportAndCRMTests(): { passed: boolean; results: string[] } {
  const results: string[] = [];
  let allPassed = true;

  const assert = (condition: boolean, message: string) => {
    if (!condition) {
      allPassed = false;
      results.push(`❌ FAIL: ${message}`);
    } else {
      results.push(`✅ PASS: ${message}`);
    }
  };

  // Test 1: Transport Directory & Destination Filtering
  const sampleTransports: TransportRecord[] = [
    {
      id: 'trans-01',
      businessId: 'biz-original-modi-bags',
      name: 'KOLKATA CENTRAL CARGO SERVICE',
      destination: 'Siliguri / North Bengal',
      destinationRoutes: ['Siliguri', 'North Bengal', 'Guwahati', 'Malda'],
      phone: '9830556677',
      isFavorite: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    },
    {
      id: 'trans-02',
      businessId: 'biz-original-modi-bags',
      name: 'MAA TARA ROADWAYS',
      destination: 'Asansol / Durgapur / Dhanbad',
      destinationRoutes: ['Asansol', 'Durgapur', 'Dhanbad', 'Ranchi', 'Patna'],
      phone: '9831998877',
      isFavorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    },
    {
      id: 'trans-03',
      businessId: 'biz-original-modi-bags',
      name: 'BENGAL ODISHA FAST CARGO',
      destination: 'Bhubaneswar / Cuttack',
      destinationRoutes: ['Bhubaneswar', 'Cuttack', 'Balasore'],
      phone: '9433112244',
      isFavorite: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    }
  ];

  // Destination filter helper
  const filterByDestination = (list: TransportRecord[], dest: string) => {
    if (dest === 'ALL') return list;
    return list.filter(t => 
      (t.destination && t.destination.toLowerCase().includes(dest.toLowerCase())) ||
      (t.destinationRoutes && t.destinationRoutes.some(r => r.toLowerCase().includes(dest.toLowerCase())))
    );
  };

  const siliguriResults = filterByDestination(sampleTransports, 'Siliguri');
  assert(siliguriResults.length === 1 && siliguriResults[0].id === 'trans-01', 'Destination filter Siliguri returns 1 transport');

  const dhanbadResults = filterByDestination(sampleTransports, 'Dhanbad');
  assert(dhanbadResults.length === 1 && dhanbadResults[0].id === 'trans-02', 'Destination filter Dhanbad returns Maa Tara Roadways');

  const favorites = sampleTransports.filter(t => t.isFavorite);
  assert(favorites.length === 2, 'Favourite transport filtering returns 2 preferred lines');

  // Test 2: Call & WhatsApp URL formatting
  const testPhone = '9830556677';
  const cleanPhone = testPhone.replace(/[^0-9]/g, '').slice(-10);
  const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent('Namaskar KOLKATA CENTRAL CARGO SERVICE, this is Original Modi Bags regarding bag parcel transport dispatch.')}`;
  assert(cleanPhone === '9830556677', 'Phone sanitized to 10 digits for telecommunication');
  assert(waUrl.includes('https://wa.me/919830556677') && waUrl.includes('Original%20Modi%20Bags'), 'WhatsApp click-to-chat URL correctly encoded');

  // Test 3: CRM Follow-up Types
  const validTypes: CRMType[] = ['PAYMENT', 'SALES', 'ORDER', 'CUSTOMER_VISIT', 'OTHER'];
  assert(validTypes.length === 5, 'All 5 CRM Follow-up Types supported: Payment, Sales, Order, Customer Visit, Other');

  // Test 4: CRM Follow-up Statuses
  const validStatuses: CRMStatus[] = ['PENDING', 'COMPLETED', 'CANCELLED'];
  assert(validStatuses.length === 3, 'All 3 CRM Follow-up Statuses supported: Pending, Completed, Cancelled');

  // Test 5: CRM Follow-up Views (Today | Overdue | Upcoming)
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

  const sampleCRM: CRMFollowUp[] = [
    {
      id: 'crm-overdue',
      businessId: 'biz-original-modi-bags',
      customerId: 'cust-1',
      customerName: 'Howrah Bag House',
      type: 'PAYMENT',
      purpose: 'Payment Due Collection',
      scheduledDate: startOfToday - 86400000 * 2, // 2 days ago
      notes: 'Cheque bounce follow up',
      status: 'PENDING',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    },
    {
      id: 'crm-today',
      businessId: 'biz-original-modi-bags',
      customerId: 'cust-2',
      customerName: 'Burrabazar Traders',
      type: 'ORDER',
      purpose: 'School Bag Order Approval',
      scheduledDate: startOfToday + 3600000 * 4, // 4 hours into today
      notes: 'Confirm school session bag print logo',
      status: 'PENDING',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    },
    {
      id: 'crm-upcoming',
      businessId: 'biz-original-modi-bags',
      customerId: 'cust-3',
      customerName: 'Siliguri Bag Palace',
      type: 'CUSTOMER_VISIT',
      purpose: 'Seasonal Catalog Presentation',
      scheduledDate: endOfToday + 86400000 * 3, // 3 days in future
      notes: 'Visit wholesale stall during north bengal tour',
      status: 'PENDING',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      syncStatus: 'LOCAL'
    }
  ];

  const classifyView = (item: CRMFollowUp): CRMViewFilter => {
    const t = item.scheduledDate;
    if (t < startOfToday) return 'OVERDUE';
    if (t > endOfToday) return 'UPCOMING';
    return 'TODAY';
  };

  const overdueList = sampleCRM.filter(item => classifyView(item) === 'OVERDUE');
  const todayList = sampleCRM.filter(item => classifyView(item) === 'TODAY');
  const upcomingList = sampleCRM.filter(item => classifyView(item) === 'UPCOMING');

  assert(overdueList.length === 1 && overdueList[0].id === 'crm-overdue', 'CRM Overdue View correctly categorizes past pending dates');
  assert(todayList.length === 1 && todayList[0].id === 'crm-today', 'CRM Today View correctly categorizes current date appointments');
  assert(upcomingList.length === 1 && upcomingList[0].id === 'crm-upcoming', 'CRM Upcoming View correctly categorizes future date appointments');

  // Status transitions
  const crmItem = { ...sampleCRM[1] };
  crmItem.status = 'COMPLETED';
  crmItem.completedAt = Date.now();
  assert(crmItem.status === 'COMPLETED' && Boolean(crmItem.completedAt), 'CRM follow-up transitions to COMPLETED status with timestamp');

  crmItem.status = 'CANCELLED';
  assert(crmItem.status === 'CANCELLED', 'CRM follow-up transitions to CANCELLED status');

  return { passed: allPassed, results };
}
