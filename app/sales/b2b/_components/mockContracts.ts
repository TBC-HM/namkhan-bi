// app/sales/b2b/_components/mockContracts.ts
// Mock 25 LPA contracts. Replace with dmc_contracts query after migration applied.

export interface MockContract {
  id: string;
  partner: string;
  country: string;
  flag: string;
  type: 'DMC' | 'OTA' | 'TO';
  status: 'active' | 'expiring' | 'expired' | 'draft';
  effective: string;
  expires: string;
  daysToExpiry: number;
  rnsYtd: number;
  revenueYtd: number;
  parity: number;
  autoRenew: boolean;
}

export const MOCK_CONTRACTS: MockContract[] = [
  { id: 'c001', partner: 'Asian Trails Laos', country: 'Laos', flag: '🇱🇦', type: 'DMC', status: 'active', effective: '2026-10-01', expires: '2027-09-30', daysToExpiry: 147, rnsYtd: 312, revenueYtd: 67080, parity: 0, autoRenew: false },
  { id: 'c002', partner: 'Laos Autrement', country: 'Laos', flag: '🇱🇦', type: 'DMC', status: 'active', effective: '2026-04-01', expires: '2027-03-31', daysToExpiry: 334, rnsYtd: 198, revenueYtd: 41580, parity: 0, autoRenew: true },
  { id: 'c003', partner: 'Tiger Trail Travel', country: 'Laos', flag: '🇱🇦', type: 'DMC', status: 'expiring', effective: '2025-08-01', expires: '2026-07-31', daysToExpiry: 91, rnsYtd: 156, revenueYtd: 32760, parity: 1, autoRenew: false },
  { id: 'c004', partner: 'Exotissimo Travel',   country: 'Laos', flag: '🇱🇦', type: 'DMC', status: 'active', effective: '2026-01-01', expires: '2026-12-31', daysToExpiry: 244, rnsYtd: 142, revenueYtd: 29820, parity: 0, autoRenew: true },
  { id: 'c005', partner: 'Diethelm Travel',     country: 'Laos', flag: '🇱🇦', type: 'DMC', status: 'active', effective: '2026-04-01', expires: '2027-03-31', daysToExpiry: 334, rnsYtd: 128, revenueYtd: 26880, parity: 0, autoRenew: false },
  { id: 'c006', partner: 'Buffalo Tours',       country: 'Vietnam', flag: '🇻🇳', type: 'DMC', status: 'active', effective: '2026-04-01', expires: '2027-03-31', daysToExpiry: 334, rnsYtd: 98, revenueYtd: 20580, parity: 0, autoRenew: true },
  { id: 'c007', partner: 'Khiri Travel',        country: 'Thailand', flag: '🇹🇭', type: 'DMC', status: 'active', effective: '2026-01-01', expires: '2026-12-31', daysToExpiry: 244, rnsYtd: 87, revenueYtd: 18270, parity: 0, autoRenew: false },
  { id: 'c008', partner: 'EasiaTravel',         country: 'Vietnam', flag: '🇻🇳', type: 'DMC', status: 'active', effective: '2026-04-01', expires: '2027-03-31', daysToExpiry: 334, rnsYtd: 76, revenueYtd: 15960, parity: 0, autoRenew: true },
  { id: 'c009', partner: 'Trails of Indochina', country: 'Vietnam', flag: '🇻🇳', type: 'DMC', status: 'active', effective: '2026-01-01', expires: '2026-12-31', daysToExpiry: 244, rnsYtd: 64, revenueYtd: 13440, parity: 0, autoRenew: false },
  { id: 'c010', partner: 'Destination Asia',    country: 'Thailand', flag: '🇹🇭', type: 'DMC', status: 'expiring', effective: '2025-06-15', expires: '2026-06-14', daysToExpiry: 44, rnsYtd: 58, revenueYtd: 12180, parity: 0, autoRenew: false },
  { id: 'c011', partner: 'Discova Laos',        country: 'Laos', flag: '🇱🇦', type: 'DMC', status: 'active', effective: '2026-04-01', expires: '2027-03-31', daysToExpiry: 334, rnsYtd: 52, revenueYtd: 10920, parity: 0, autoRenew: true },
  { id: 'c012', partner: 'Indochina Voyages',   country: 'Cambodia', flag: '🇰🇭', type: 'DMC', status: 'active', effective: '2026-01-01', expires: '2026-12-31', daysToExpiry: 244, rnsYtd: 48, revenueYtd: 10080, parity: 0, autoRenew: false },
  { id: 'c013', partner: 'Wendy Wu Tours',      country: 'UK', flag: '🇬🇧', type: 'TO',  status: 'active', effective: '2026-04-01', expires: '2027-03-31', daysToExpiry: 334, rnsYtd: 42, revenueYtd: 8820,  parity: 0, autoRenew: true },
  { id: 'c014', partner: 'G Adventures',        country: 'Canada', flag: '🇨🇦', type: 'TO', status: 'active', effective: '2026-01-01', expires: '2026-12-31', daysToExpiry: 244, rnsYtd: 38, revenueYtd: 7980, parity: 0, autoRenew: false },
  { id: 'c015', partner: 'Intrepid Travel',     country: 'Australia', flag: '🇦🇺', type: 'TO', status: 'active', effective: '2026-04-01', expires: '2027-03-31', daysToExpiry: 334, rnsYtd: 36, revenueYtd: 7560, parity: 0, autoRenew: true },
  { id: 'c016', partner: 'Audley Travel',       country: 'UK', flag: '🇬🇧', type: 'TO', status: 'active', effective: '2026-01-01', expires: '2026-12-31', daysToExpiry: 244, rnsYtd: 32, revenueYtd: 6720, parity: 0, autoRenew: false },
  { id: 'c017', partner: 'Ampersand Travel',    country: 'UK', flag: '🇬🇧', type: 'TO', status: 'active', effective: '2026-04-01', expires: '2027-03-31', daysToExpiry: 334, rnsYtd: 28, revenueYtd: 5880, parity: 0, autoRenew: true },
  { id: 'c018', partner: 'Remote Lands',        country: 'USA', flag: '🇺🇸', type: 'TO', status: 'active', effective: '2026-01-01', expires: '2026-12-31', daysToExpiry: 244, rnsYtd: 24, revenueYtd: 5040, parity: 0, autoRenew: false },
  { id: 'c019', partner: 'Abercrombie & Kent',  country: 'UK', flag: '🇬🇧', type: 'TO', status: 'expiring', effective: '2025-09-01', expires: '2026-08-31', daysToExpiry: 122, rnsYtd: 22, revenueYtd: 4620, parity: 0, autoRenew: false },
  { id: 'c020', partner: 'Cox & Kings',         country: 'India', flag: '🇮🇳', type: 'TO', status: 'active', effective: '2026-04-01', expires: '2027-03-31', daysToExpiry: 334, rnsYtd: 18, revenueYtd: 3780, parity: 0, autoRenew: true },
  { id: 'c021', partner: 'Travel Indochina',    country: 'Australia', flag: '🇦🇺', type: 'TO', status: 'active', effective: '2026-01-01', expires: '2026-12-31', daysToExpiry: 244, rnsYtd: 16, revenueYtd: 3360, parity: 0, autoRenew: false },
  { id: 'c022', partner: 'About Asia Travel',   country: 'Cambodia', flag: '🇰🇭', type: 'DMC', status: 'active', effective: '2026-04-01', expires: '2027-03-31', daysToExpiry: 334, rnsYtd: 14, revenueYtd: 2940, parity: 0, autoRenew: true },
  { id: 'c023', partner: 'Backyard Travel',     country: 'Thailand', flag: '🇹🇭', type: 'DMC', status: 'expired', effective: '2024-04-01', expires: '2025-03-31', daysToExpiry: -396, rnsYtd: 0, revenueYtd: 0, parity: 0, autoRenew: false },
  { id: 'c024', partner: 'Greaves Travel',      country: 'UK', flag: '🇬🇧', type: 'TO', status: 'draft', effective: '2026-06-01', expires: '2027-05-31', daysToExpiry: 396, rnsYtd: 0, revenueYtd: 0, parity: 0, autoRenew: false },
  { id: 'c025', partner: 'Asia Adventures',     country: 'Thailand', flag: '🇹🇭', type: 'DMC', status: 'active', effective: '2026-04-01', expires: '2027-03-31', daysToExpiry: 334, rnsYtd: 12, revenueYtd: 2520, parity: 0, autoRenew: true },
];
