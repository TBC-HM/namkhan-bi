# Extracted from 7d00ca1f-revenue_monetization_capitalization_model.xlsx (structure + formulas; original xlsx retained by PBS)

## Sheet: Dashboard  (16 rows x 12 cols)
| Revenue, Monetization & Capitalization Dashboard |  |  |  |  |  |  |  |  |  |  |  |
| Illustrative enterprise model — link to Supabase views and billing provider in p |  |  |  |  |  |  |  |  |  |  |  |
| MRR |  | Recognized Revenue |  | Collected Cash |  | Gross Margin |  | Free Plan Burn |  | Build Investment |  |
|  | =SUM('Customer Economics'!$B$2:$B$100) |  | =SUM('Revenue Recognition'!$G$2:$G$200) |  | =SUM('Customer Economics'!$D$2:$D$100) |  | =IFERROR((SUM('Customer Economics'!$C$2:$C$100)-SUM('Customer Economics'!$E$2:$E |  | =SUM('Free Plan'!$F$2:$F$100) |  | =SUM('Capital Investment'!$F$2:$F$100) |
| Revenue by Business Model |  |  |  |  |  | Commercial Governance |  |  |  |  |  |
| Business Model | Monthly Revenue ($) |  |  |  |  | Control | Threshold | Observed | Status | Owner | Action |
| Base subscription | =SUMIF('Customer Contracts'!$E$2:$E$200,"Base Subscription",'Customer Contracts' |  |  |  |  | Gross margin floor | 0.6 | =H6 | =IF(I11>=H11,"OK","Review") | Commercial | Review low-margin tenants |
| Module add-ons | =SUMIF('Customer Contracts'!$E$2:$E$200,"Module Add-on",'Customer Contracts'!$K$ |  |  |  |  | Free cost / free tenant | 10 | =IFERROR(J6/SUM('Free Plan'!$B$2:$B$100),0) | =IF(I12<=H12,"OK","Review") | Growth | Throttle or convert |
| Usage overage | =SUMIF('Customer Contracts'!$E$2:$E$200,"Usage Overage",'Customer Contracts'!$K$ |  |  |  |  | Unbilled usage % | 0.01 | =IFERROR(SUM('Usage & Billing'!$J$2:$J$200)/SUM('Usage & Billing'!$I$2:$I$200),0 | =IF(I13<=H13,"OK","Review") | Finance | Reconcile rating |
| Implementation / services | =SUMIF('Customer Contracts'!$E$2:$E$200,"Implementation",'Customer Contracts'!$K |  |  |  |  | Discount approval | 0.2 | =MAX('Customer Contracts'!$I$2:$I$200) | =IF(I14<=H14,"OK","Review") | Deal Desk | Approval required |
| Credit packs | =SUMIF('Customer Contracts'!$E$2:$E$200,"Credit Pack",'Customer Contracts'!$K$2: |  |  |  |  | Build recovery period (months) | 36 | =IFERROR(L6/SUM('Module Economics'!$H$2:$H$100),0) | =IF(I15<=H15,"OK","Review") | Product | Review portfolio |
| Partner / other | =SUMIF('Customer Contracts'!$E$2:$E$200,"Partner",'Customer Contracts'!$K$2:$K$2 |  |  |  |  | Revenue concentration | 0.3 | =IFERROR(MAX('Customer Economics'!$B$2:$B$100)/B6,0) | =IF(I16<=H16,"OK","Review") | Executive | Diversify |

## Sheet: Plans & Packages  (100 rows x 12 cols)
| Product Code | Product Name | Kind | Version | Billing Interval | Base Price ($) | Included Credits ($) | Included Seats | Included Modules | Free Plan | Status | Effective From |
| PLAN-FREE | Free | Plan | 1.0 | Month | 0 | 5 | 1 | Core | True | Active | 2026-08-01 00:00:00 |
| PLAN-START | Starter | Plan | 1.0 | Month | 99 | 20 | 3 | Core, Reports | False | Active | 2026-08-01 00:00:00 |
| PLAN-PRO | Professional | Plan | 1.0 | Month | 399 | 100 | 10 | Core, Reports, Content, Forecast | False | Active | 2026-08-01 00:00:00 |
| PLAN-ENT | Enterprise | Plan | 1.0 | Year | 24000 | 3000 | 50 | All contracted | False | Active | 2026-08-01 00:00:00 |
| MOD-FORE | Forecasting | Module | 1.0 | Month | 149 | 0 | 0 | Forecasting | False | Active | 2026-08-01 00:00:00 |
| MOD-CONT | Content Engine | Module | 1.0 | Month | 99 | 0 | 0 | Content | False | Active | 2026-08-01 00:00:00 |
| PKG-HOSP | Hospitality Intelligence Suite | Package | 1.0 | Month | 799 | 250 | 20 | Forecast, Revenue, Content, Sheets | False | Active | 2026-08-01 00:00:00 |
... truncated at 60 of 100 rows

## Sheet: Pricing Components  (100 rows x 13 cols)
| Price ID | Product Code | Charge Type | Pricing Model | Meter | Included Qty | Unit Price ($) | Minimum ($) | Maximum ($) | Markup % | Tier Definition | Effective From | Status |
| P-001 | PLAN-START | Recurring | Flat |  | 1 | 99 | 99 |  | 0 |  | 2026-08-01 00:00:00 | Active |
| P-002 | PLAN-PRO | Recurring | Flat |  | 1 | 399 | 399 |  | 0 |  | 2026-08-01 00:00:00 | Active |
| P-003 | USAGE-AI | Metered | Per Unit | AI Cost Dollar | 1 | 1.5 | 0 |  | 0.5 | $1.50 customer charge per $1.00 cost | 2026-08-01 00:00:00 | Active |
| P-004 | USAGE-TASK | Metered | Graduated | Successful Task | 100 | 0.2 | 0 |  | 0 | 101-1,000: $0.20; 1,001+: $0.15 | 2026-08-01 00:00:00 | Active |
| P-005 | MOD-FORE | Recurring | Flat |  | 1 | 149 | 149 |  | 0 |  | 2026-08-01 00:00:00 | Active |
| P-006 | SERVICE-CUSTOM | One-time | Cost Plus |  | 1 | 0 | 500 |  | 0.35 | Actual cost + 35% | 2026-08-01 00:00:00 | Active |
... truncated at 60 of 100 rows

## Sheet: Customer Contracts  (200 rows x 15 cols)
| Contract ID | Tenant | Plan / Product | Component | Business Model | Qty | List Price ($) | Custom Price ($) | Discount % | Cost to Serve ($) | Monthly Revenue ($) | Gross Profit ($) | Gross Margin | Status | Renewal Date |
| C-001 | Tenant A | Professional | Base Plan | Base Subscription | 1 | 399 | 399 | 0 | 120 | =F2*H2 | =K2-J2 | =IFERROR(L2/K2,0) | Active | 2027-07-31 00:00:00 |
| C-002 | Tenant A | Forecasting | Module | Module Add-on | 1 | 149 | 129 | 0.1342 | 35 | =F3*H3 | =K3-J3 | =IFERROR(L3/K3,0) | Active | 2027-07-31 00:00:00 |
| C-003 | Tenant A | AI Overage | Meter | Usage Overage | 1 | 180 | 180 | 0 | 90 | =F4*H4 | =K4-J4 | =IFERROR(L4/K4,0) | Active | 2027-07-31 00:00:00 |
| C-004 | Tenant B | Starter | Base Plan | Base Subscription | 1 | 99 | 99 | 0 | 38 | =F5*H5 | =K5-J5 | =IFERROR(L5/K5,0) | Active | 2026-12-31 00:00:00 |
| C-005 | Tenant B | Custom Campaign | Service | Implementation | 1 | 1500 | 1400 | 0.0667 | 850 | =F6*H6 | =K6-J6 | =IFERROR(L6/K6,0) | Completed | 2026-08-31 00:00:00 |
| C-006 | Tenant C | Free | Base Plan | Base Subscription | 1 | 0 | 0 | 0 | 8 | =F7*H7 | =K7-J7 | =IFERROR(L7/K7,0) | Active | 2027-07-31 00:00:00 |
|  |  |  |  |  |  |  |  |  |  | =F8*H8 | =K8-J8 | =IFERROR(L8/K8,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F9*H9 | =K9-J9 | =IFERROR(L9/K9,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F10*H10 | =K10-J10 | =IFERROR(L10/K10,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F11*H11 | =K11-J11 | =IFERROR(L11/K11,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F12*H12 | =K12-J12 | =IFERROR(L12/K12,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F13*H13 | =K13-J13 | =IFERROR(L13/K13,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F14*H14 | =K14-J14 | =IFERROR(L14/K14,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F15*H15 | =K15-J15 | =IFERROR(L15/K15,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F16*H16 | =K16-J16 | =IFERROR(L16/K16,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F17*H17 | =K17-J17 | =IFERROR(L17/K17,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F18*H18 | =K18-J18 | =IFERROR(L18/K18,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F19*H19 | =K19-J19 | =IFERROR(L19/K19,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F20*H20 | =K20-J20 | =IFERROR(L20/K20,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F21*H21 | =K21-J21 | =IFERROR(L21/K21,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F22*H22 | =K22-J22 | =IFERROR(L22/K22,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F23*H23 | =K23-J23 | =IFERROR(L23/K23,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F24*H24 | =K24-J24 | =IFERROR(L24/K24,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F25*H25 | =K25-J25 | =IFERROR(L25/K25,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F26*H26 | =K26-J26 | =IFERROR(L26/K26,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F27*H27 | =K27-J27 | =IFERROR(L27/K27,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F28*H28 | =K28-J28 | =IFERROR(L28/K28,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F29*H29 | =K29-J29 | =IFERROR(L29/K29,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F30*H30 | =K30-J30 | =IFERROR(L30/K30,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F31*H31 | =K31-J31 | =IFERROR(L31/K31,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F32*H32 | =K32-J32 | =IFERROR(L32/K32,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F33*H33 | =K33-J33 | =IFERROR(L33/K33,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F34*H34 | =K34-J34 | =IFERROR(L34/K34,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F35*H35 | =K35-J35 | =IFERROR(L35/K35,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F36*H36 | =K36-J36 | =IFERROR(L36/K36,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F37*H37 | =K37-J37 | =IFERROR(L37/K37,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F38*H38 | =K38-J38 | =IFERROR(L38/K38,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F39*H39 | =K39-J39 | =IFERROR(L39/K39,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F40*H40 | =K40-J40 | =IFERROR(L40/K40,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F41*H41 | =K41-J41 | =IFERROR(L41/K41,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F42*H42 | =K42-J42 | =IFERROR(L42/K42,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F43*H43 | =K43-J43 | =IFERROR(L43/K43,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F44*H44 | =K44-J44 | =IFERROR(L44/K44,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F45*H45 | =K45-J45 | =IFERROR(L45/K45,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F46*H46 | =K46-J46 | =IFERROR(L46/K46,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F47*H47 | =K47-J47 | =IFERROR(L47/K47,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F48*H48 | =K48-J48 | =IFERROR(L48/K48,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F49*H49 | =K49-J49 | =IFERROR(L49/K49,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F50*H50 | =K50-J50 | =IFERROR(L50/K50,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F51*H51 | =K51-J51 | =IFERROR(L51/K51,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F52*H52 | =K52-J52 | =IFERROR(L52/K52,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F53*H53 | =K53-J53 | =IFERROR(L53/K53,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F54*H54 | =K54-J54 | =IFERROR(L54/K54,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F55*H55 | =K55-J55 | =IFERROR(L55/K55,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F56*H56 | =K56-J56 | =IFERROR(L56/K56,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F57*H57 | =K57-J57 | =IFERROR(L57/K57,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F58*H58 | =K58-J58 | =IFERROR(L58/K58,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F59*H59 | =K59-J59 | =IFERROR(L59/K59,0) |  |  |
|  |  |  |  |  |  |  |  |  |  | =F60*H60 | =K60-J60 | =IFERROR(L60/K60,0) |  |  |
... truncated at 60 of 200 rows

## Sheet: Usage & Billing  (200 rows x 15 cols)
| Usage Event | Date | Tenant | Module | Meter | Quantity | Included Qty | Billable Qty | Gross Rated ($) | Credits / Discounts ($) | Net Billable ($) | Invoice Status | Cost Event ($) | Gross Profit ($) | Margin |
| U-001 | 2026-07-10 00:00:00 | Tenant A | Forecasting | AI Cost Dollar | 90 | 20 | =MAX(0,F2-G2) | =IF(E2="AI Cost Dollar",H2*1.5,H2*0.2) | 0 | =MAX(0,I2-J2) | Invoiced | 60 | =K2-M2 | =IFERROR(N2/K2,0) |
| U-002 | 2026-07-12 00:00:00 | Tenant A | Content | Successful Task | 450 | 100 | =MAX(0,F3-G3) | =IF(E3="AI Cost Dollar",H3*1.5,H3*0.2) | 5 | =MAX(0,I3-J3) | Draft | 35 | =K3-M3 | =IFERROR(N3/K3,0) |
| U-003 | 2026-07-15 00:00:00 | Tenant B | Content | AI Cost Dollar | 22 | 20 | =MAX(0,F4-G4) | =IF(E4="AI Cost Dollar",H4*1.5,H4*0.2) | 0 | =MAX(0,I4-J4) | Unbilled | 14 | =K4-M4 | =IFERROR(N4/K4,0) |
| U-004 | 2026-07-18 00:00:00 | Tenant C | Core | AI Cost Dollar | 6 | 5 | =MAX(0,F5-G5) | =IF(E5="AI Cost Dollar",H5*1.5,H5*0.2) | 1.5 | =MAX(0,I5-J5) | Free | 4 | =K5-M5 | =IFERROR(N5/K5,0) |
|  |  |  |  |  |  |  | =MAX(0,F6-G6) | =IF(E6="AI Cost Dollar",H6*1.5,H6*0.2) |  | =MAX(0,I6-J6) |  |  | =K6-M6 | =IFERROR(N6/K6,0) |
|  |  |  |  |  |  |  | =MAX(0,F7-G7) | =IF(E7="AI Cost Dollar",H7*1.5,H7*0.2) |  | =MAX(0,I7-J7) |  |  | =K7-M7 | =IFERROR(N7/K7,0) |
|  |  |  |  |  |  |  | =MAX(0,F8-G8) | =IF(E8="AI Cost Dollar",H8*1.5,H8*0.2) |  | =MAX(0,I8-J8) |  |  | =K8-M8 | =IFERROR(N8/K8,0) |
|  |  |  |  |  |  |  | =MAX(0,F9-G9) | =IF(E9="AI Cost Dollar",H9*1.5,H9*0.2) |  | =MAX(0,I9-J9) |  |  | =K9-M9 | =IFERROR(N9/K9,0) |
|  |  |  |  |  |  |  | =MAX(0,F10-G10) | =IF(E10="AI Cost Dollar",H10*1.5,H10*0.2) |  | =MAX(0,I10-J10) |  |  | =K10-M10 | =IFERROR(N10/K10,0) |
|  |  |  |  |  |  |  | =MAX(0,F11-G11) | =IF(E11="AI Cost Dollar",H11*1.5,H11*0.2) |  | =MAX(0,I11-J11) |  |  | =K11-M11 | =IFERROR(N11/K11,0) |
|  |  |  |  |  |  |  | =MAX(0,F12-G12) | =IF(E12="AI Cost Dollar",H12*1.5,H12*0.2) |  | =MAX(0,I12-J12) |  |  | =K12-M12 | =IFERROR(N12/K12,0) |
|  |  |  |  |  |  |  | =MAX(0,F13-G13) | =IF(E13="AI Cost Dollar",H13*1.5,H13*0.2) |  | =MAX(0,I13-J13) |  |  | =K13-M13 | =IFERROR(N13/K13,0) |
|  |  |  |  |  |  |  | =MAX(0,F14-G14) | =IF(E14="AI Cost Dollar",H14*1.5,H14*0.2) |  | =MAX(0,I14-J14) |  |  | =K14-M14 | =IFERROR(N14/K14,0) |
|  |  |  |  |  |  |  | =MAX(0,F15-G15) | =IF(E15="AI Cost Dollar",H15*1.5,H15*0.2) |  | =MAX(0,I15-J15) |  |  | =K15-M15 | =IFERROR(N15/K15,0) |
|  |  |  |  |  |  |  | =MAX(0,F16-G16) | =IF(E16="AI Cost Dollar",H16*1.5,H16*0.2) |  | =MAX(0,I16-J16) |  |  | =K16-M16 | =IFERROR(N16/K16,0) |
|  |  |  |  |  |  |  | =MAX(0,F17-G17) | =IF(E17="AI Cost Dollar",H17*1.5,H17*0.2) |  | =MAX(0,I17-J17) |  |  | =K17-M17 | =IFERROR(N17/K17,0) |
|  |  |  |  |  |  |  | =MAX(0,F18-G18) | =IF(E18="AI Cost Dollar",H18*1.5,H18*0.2) |  | =MAX(0,I18-J18) |  |  | =K18-M18 | =IFERROR(N18/K18,0) |
|  |  |  |  |  |  |  | =MAX(0,F19-G19) | =IF(E19="AI Cost Dollar",H19*1.5,H19*0.2) |  | =MAX(0,I19-J19) |  |  | =K19-M19 | =IFERROR(N19/K19,0) |
|  |  |  |  |  |  |  | =MAX(0,F20-G20) | =IF(E20="AI Cost Dollar",H20*1.5,H20*0.2) |  | =MAX(0,I20-J20) |  |  | =K20-M20 | =IFERROR(N20/K20,0) |
|  |  |  |  |  |  |  | =MAX(0,F21-G21) | =IF(E21="AI Cost Dollar",H21*1.5,H21*0.2) |  | =MAX(0,I21-J21) |  |  | =K21-M21 | =IFERROR(N21/K21,0) |
|  |  |  |  |  |  |  | =MAX(0,F22-G22) | =IF(E22="AI Cost Dollar",H22*1.5,H22*0.2) |  | =MAX(0,I22-J22) |  |  | =K22-M22 | =IFERROR(N22/K22,0) |
|  |  |  |  |  |  |  | =MAX(0,F23-G23) | =IF(E23="AI Cost Dollar",H23*1.5,H23*0.2) |  | =MAX(0,I23-J23) |  |  | =K23-M23 | =IFERROR(N23/K23,0) |
|  |  |  |  |  |  |  | =MAX(0,F24-G24) | =IF(E24="AI Cost Dollar",H24*1.5,H24*0.2) |  | =MAX(0,I24-J24) |  |  | =K24-M24 | =IFERROR(N24/K24,0) |
|  |  |  |  |  |  |  | =MAX(0,F25-G25) | =IF(E25="AI Cost Dollar",H25*1.5,H25*0.2) |  | =MAX(0,I25-J25) |  |  | =K25-M25 | =IFERROR(N25/K25,0) |
|  |  |  |  |  |  |  | =MAX(0,F26-G26) | =IF(E26="AI Cost Dollar",H26*1.5,H26*0.2) |  | =MAX(0,I26-J26) |  |  | =K26-M26 | =IFERROR(N26/K26,0) |
|  |  |  |  |  |  |  | =MAX(0,F27-G27) | =IF(E27="AI Cost Dollar",H27*1.5,H27*0.2) |  | =MAX(0,I27-J27) |  |  | =K27-M27 | =IFERROR(N27/K27,0) |
|  |  |  |  |  |  |  | =MAX(0,F28-G28) | =IF(E28="AI Cost Dollar",H28*1.5,H28*0.2) |  | =MAX(0,I28-J28) |  |  | =K28-M28 | =IFERROR(N28/K28,0) |
|  |  |  |  |  |  |  | =MAX(0,F29-G29) | =IF(E29="AI Cost Dollar",H29*1.5,H29*0.2) |  | =MAX(0,I29-J29) |  |  | =K29-M29 | =IFERROR(N29/K29,0) |
|  |  |  |  |  |  |  | =MAX(0,F30-G30) | =IF(E30="AI Cost Dollar",H30*1.5,H30*0.2) |  | =MAX(0,I30-J30) |  |  | =K30-M30 | =IFERROR(N30/K30,0) |
|  |  |  |  |  |  |  | =MAX(0,F31-G31) | =IF(E31="AI Cost Dollar",H31*1.5,H31*0.2) |  | =MAX(0,I31-J31) |  |  | =K31-M31 | =IFERROR(N31/K31,0) |
|  |  |  |  |  |  |  | =MAX(0,F32-G32) | =IF(E32="AI Cost Dollar",H32*1.5,H32*0.2) |  | =MAX(0,I32-J32) |  |  | =K32-M32 | =IFERROR(N32/K32,0) |
|  |  |  |  |  |  |  | =MAX(0,F33-G33) | =IF(E33="AI Cost Dollar",H33*1.5,H33*0.2) |  | =MAX(0,I33-J33) |  |  | =K33-M33 | =IFERROR(N33/K33,0) |
|  |  |  |  |  |  |  | =MAX(0,F34-G34) | =IF(E34="AI Cost Dollar",H34*1.5,H34*0.2) |  | =MAX(0,I34-J34) |  |  | =K34-M34 | =IFERROR(N34/K34,0) |
|  |  |  |  |  |  |  | =MAX(0,F35-G35) | =IF(E35="AI Cost Dollar",H35*1.5,H35*0.2) |  | =MAX(0,I35-J35) |  |  | =K35-M35 | =IFERROR(N35/K35,0) |
|  |  |  |  |  |  |  | =MAX(0,F36-G36) | =IF(E36="AI Cost Dollar",H36*1.5,H36*0.2) |  | =MAX(0,I36-J36) |  |  | =K36-M36 | =IFERROR(N36/K36,0) |
|  |  |  |  |  |  |  | =MAX(0,F37-G37) | =IF(E37="AI Cost Dollar",H37*1.5,H37*0.2) |  | =MAX(0,I37-J37) |  |  | =K37-M37 | =IFERROR(N37/K37,0) |
|  |  |  |  |  |  |  | =MAX(0,F38-G38) | =IF(E38="AI Cost Dollar",H38*1.5,H38*0.2) |  | =MAX(0,I38-J38) |  |  | =K38-M38 | =IFERROR(N38/K38,0) |
|  |  |  |  |  |  |  | =MAX(0,F39-G39) | =IF(E39="AI Cost Dollar",H39*1.5,H39*0.2) |  | =MAX(0,I39-J39) |  |  | =K39-M39 | =IFERROR(N39/K39,0) |
|  |  |  |  |  |  |  | =MAX(0,F40-G40) | =IF(E40="AI Cost Dollar",H40*1.5,H40*0.2) |  | =MAX(0,I40-J40) |  |  | =K40-M40 | =IFERROR(N40/K40,0) |
|  |  |  |  |  |  |  | =MAX(0,F41-G41) | =IF(E41="AI Cost Dollar",H41*1.5,H41*0.2) |  | =MAX(0,I41-J41) |  |  | =K41-M41 | =IFERROR(N41/K41,0) |
|  |  |  |  |  |  |  | =MAX(0,F42-G42) | =IF(E42="AI Cost Dollar",H42*1.5,H42*0.2) |  | =MAX(0,I42-J42) |  |  | =K42-M42 | =IFERROR(N42/K42,0) |
|  |  |  |  |  |  |  | =MAX(0,F43-G43) | =IF(E43="AI Cost Dollar",H43*1.5,H43*0.2) |  | =MAX(0,I43-J43) |  |  | =K43-M43 | =IFERROR(N43/K43,0) |
|  |  |  |  |  |  |  | =MAX(0,F44-G44) | =IF(E44="AI Cost Dollar",H44*1.5,H44*0.2) |  | =MAX(0,I44-J44) |  |  | =K44-M44 | =IFERROR(N44/K44,0) |
|  |  |  |  |  |  |  | =MAX(0,F45-G45) | =IF(E45="AI Cost Dollar",H45*1.5,H45*0.2) |  | =MAX(0,I45-J45) |  |  | =K45-M45 | =IFERROR(N45/K45,0) |
|  |  |  |  |  |  |  | =MAX(0,F46-G46) | =IF(E46="AI Cost Dollar",H46*1.5,H46*0.2) |  | =MAX(0,I46-J46) |  |  | =K46-M46 | =IFERROR(N46/K46,0) |
|  |  |  |  |  |  |  | =MAX(0,F47-G47) | =IF(E47="AI Cost Dollar",H47*1.5,H47*0.2) |  | =MAX(0,I47-J47) |  |  | =K47-M47 | =IFERROR(N47/K47,0) |
|  |  |  |  |  |  |  | =MAX(0,F48-G48) | =IF(E48="AI Cost Dollar",H48*1.5,H48*0.2) |  | =MAX(0,I48-J48) |  |  | =K48-M48 | =IFERROR(N48/K48,0) |
|  |  |  |  |  |  |  | =MAX(0,F49-G49) | =IF(E49="AI Cost Dollar",H49*1.5,H49*0.2) |  | =MAX(0,I49-J49) |  |  | =K49-M49 | =IFERROR(N49/K49,0) |
|  |  |  |  |  |  |  | =MAX(0,F50-G50) | =IF(E50="AI Cost Dollar",H50*1.5,H50*0.2) |  | =MAX(0,I50-J50) |  |  | =K50-M50 | =IFERROR(N50/K50,0) |
|  |  |  |  |  |  |  | =MAX(0,F51-G51) | =IF(E51="AI Cost Dollar",H51*1.5,H51*0.2) |  | =MAX(0,I51-J51) |  |  | =K51-M51 | =IFERROR(N51/K51,0) |
|  |  |  |  |  |  |  | =MAX(0,F52-G52) | =IF(E52="AI Cost Dollar",H52*1.5,H52*0.2) |  | =MAX(0,I52-J52) |  |  | =K52-M52 | =IFERROR(N52/K52,0) |
|  |  |  |  |  |  |  | =MAX(0,F53-G53) | =IF(E53="AI Cost Dollar",H53*1.5,H53*0.2) |  | =MAX(0,I53-J53) |  |  | =K53-M53 | =IFERROR(N53/K53,0) |
|  |  |  |  |  |  |  | =MAX(0,F54-G54) | =IF(E54="AI Cost Dollar",H54*1.5,H54*0.2) |  | =MAX(0,I54-J54) |  |  | =K54-M54 | =IFERROR(N54/K54,0) |
|  |  |  |  |  |  |  | =MAX(0,F55-G55) | =IF(E55="AI Cost Dollar",H55*1.5,H55*0.2) |  | =MAX(0,I55-J55) |  |  | =K55-M55 | =IFERROR(N55/K55,0) |
|  |  |  |  |  |  |  | =MAX(0,F56-G56) | =IF(E56="AI Cost Dollar",H56*1.5,H56*0.2) |  | =MAX(0,I56-J56) |  |  | =K56-M56 | =IFERROR(N56/K56,0) |
|  |  |  |  |  |  |  | =MAX(0,F57-G57) | =IF(E57="AI Cost Dollar",H57*1.5,H57*0.2) |  | =MAX(0,I57-J57) |  |  | =K57-M57 | =IFERROR(N57/K57,0) |
|  |  |  |  |  |  |  | =MAX(0,F58-G58) | =IF(E58="AI Cost Dollar",H58*1.5,H58*0.2) |  | =MAX(0,I58-J58) |  |  | =K58-M58 | =IFERROR(N58/K58,0) |
|  |  |  |  |  |  |  | =MAX(0,F59-G59) | =IF(E59="AI Cost Dollar",H59*1.5,H59*0.2) |  | =MAX(0,I59-J59) |  |  | =K59-M59 | =IFERROR(N59/K59,0) |
|  |  |  |  |  |  |  | =MAX(0,F60-G60) | =IF(E60="AI Cost Dollar",H60*1.5,H60*0.2) |  | =MAX(0,I60-J60) |  |  | =K60-M60 | =IFERROR(N60/K60,0) |
... truncated at 60 of 200 rows

## Sheet: Customer Economics  (100 rows x 12 cols)
| Tenant | MRR ($) | Billed Revenue ($) | Collected Cash ($) | Direct Cost ($) | Allocated Support ($) | Gross Profit ($) | Contribution ($) | Gross Margin | Contribution Margin | Plan | Status |
| Tenant A | =SUMIFS('Customer Contracts'!$K$2:$K$200,'Customer Contracts'!$B$2:$B$200,A2,'Cu | =SUMIFS('Customer Contracts'!$K$2:$K$200,'Customer Contracts'!$B$2:$B$200,A2)+SU | =C2*0.97 | =SUMIFS('Customer Contracts'!$J$2:$J$200,'Customer Contracts'!$B$2:$B$200,A2)+SU | 40 | =C2-E2 | =G2-F2 | =IFERROR(G2/C2,0) | =IFERROR(H2/C2,0) | Professional + Forecast | Healthy |
| Tenant B | =SUMIFS('Customer Contracts'!$K$2:$K$200,'Customer Contracts'!$B$2:$B$200,A3,'Cu | =SUMIFS('Customer Contracts'!$K$2:$K$200,'Customer Contracts'!$B$2:$B$200,A3)+SU | =C3*0.97 | =SUMIFS('Customer Contracts'!$J$2:$J$200,'Customer Contracts'!$B$2:$B$200,A3)+SU | 20 | =C3-E3 | =G3-F3 | =IFERROR(G3/C3,0) | =IFERROR(H3/C3,0) | Starter | Review |
| Tenant C | =SUMIFS('Customer Contracts'!$K$2:$K$200,'Customer Contracts'!$B$2:$B$200,A4,'Cu | =SUMIFS('Customer Contracts'!$K$2:$K$200,'Customer Contracts'!$B$2:$B$200,A4)+SU | =C4*0.97 | =SUMIFS('Customer Contracts'!$J$2:$J$200,'Customer Contracts'!$B$2:$B$200,A4)+SU | 2 | =C4-E4 | =G4-F4 | =IFERROR(G4/C4,0) | =IFERROR(H4/C4,0) | Free | Free Cohort |
... truncated at 60 of 100 rows

## Sheet: Free Plan  (100 rows x 11 cols)
| Cohort | Active Free Tenants | Activated Tenants | Converted Paid | Conversion Rate | Total Cost ($) | Cost / Active ($) | Shadow Revenue ($) | Shadow Margin | Cost Ceiling ($) | Action |
| Organic | 120 | 85 | 12 | =IFERROR(D2/C2,0) | 720 | =IFERROR(F2/B2,0) | 1800 | =IFERROR((H2-F2)/H2,0) | 10 | =IF(G2>J2,"Throttle / Upgrade","Within policy") |
| Partner | 60 | 50 | 9 | =IFERROR(D3/C3,0) | 540 | =IFERROR(F3/B3,0) | 1350 | =IFERROR((H3-F3)/H3,0) | 12 | =IF(G3>J3,"Throttle / Upgrade","Within policy") |
| Beta | 30 | 28 | 4 | =IFERROR(D4/C4,0) | 420 | =IFERROR(F4/B4,0) | 800 | =IFERROR((H4-F4)/H4,0) | 15 | =IF(G4>J4,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D5/C5,0) |  | =IFERROR(F5/B5,0) |  | =IFERROR((H5-F5)/H5,0) |  | =IF(G5>J5,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D6/C6,0) |  | =IFERROR(F6/B6,0) |  | =IFERROR((H6-F6)/H6,0) |  | =IF(G6>J6,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D7/C7,0) |  | =IFERROR(F7/B7,0) |  | =IFERROR((H7-F7)/H7,0) |  | =IF(G7>J7,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D8/C8,0) |  | =IFERROR(F8/B8,0) |  | =IFERROR((H8-F8)/H8,0) |  | =IF(G8>J8,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D9/C9,0) |  | =IFERROR(F9/B9,0) |  | =IFERROR((H9-F9)/H9,0) |  | =IF(G9>J9,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D10/C10,0) |  | =IFERROR(F10/B10,0) |  | =IFERROR((H10-F10)/H10,0) |  | =IF(G10>J10,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D11/C11,0) |  | =IFERROR(F11/B11,0) |  | =IFERROR((H11-F11)/H11,0) |  | =IF(G11>J11,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D12/C12,0) |  | =IFERROR(F12/B12,0) |  | =IFERROR((H12-F12)/H12,0) |  | =IF(G12>J12,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D13/C13,0) |  | =IFERROR(F13/B13,0) |  | =IFERROR((H13-F13)/H13,0) |  | =IF(G13>J13,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D14/C14,0) |  | =IFERROR(F14/B14,0) |  | =IFERROR((H14-F14)/H14,0) |  | =IF(G14>J14,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D15/C15,0) |  | =IFERROR(F15/B15,0) |  | =IFERROR((H15-F15)/H15,0) |  | =IF(G15>J15,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D16/C16,0) |  | =IFERROR(F16/B16,0) |  | =IFERROR((H16-F16)/H16,0) |  | =IF(G16>J16,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D17/C17,0) |  | =IFERROR(F17/B17,0) |  | =IFERROR((H17-F17)/H17,0) |  | =IF(G17>J17,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D18/C18,0) |  | =IFERROR(F18/B18,0) |  | =IFERROR((H18-F18)/H18,0) |  | =IF(G18>J18,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D19/C19,0) |  | =IFERROR(F19/B19,0) |  | =IFERROR((H19-F19)/H19,0) |  | =IF(G19>J19,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D20/C20,0) |  | =IFERROR(F20/B20,0) |  | =IFERROR((H20-F20)/H20,0) |  | =IF(G20>J20,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D21/C21,0) |  | =IFERROR(F21/B21,0) |  | =IFERROR((H21-F21)/H21,0) |  | =IF(G21>J21,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D22/C22,0) |  | =IFERROR(F22/B22,0) |  | =IFERROR((H22-F22)/H22,0) |  | =IF(G22>J22,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D23/C23,0) |  | =IFERROR(F23/B23,0) |  | =IFERROR((H23-F23)/H23,0) |  | =IF(G23>J23,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D24/C24,0) |  | =IFERROR(F24/B24,0) |  | =IFERROR((H24-F24)/H24,0) |  | =IF(G24>J24,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D25/C25,0) |  | =IFERROR(F25/B25,0) |  | =IFERROR((H25-F25)/H25,0) |  | =IF(G25>J25,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D26/C26,0) |  | =IFERROR(F26/B26,0) |  | =IFERROR((H26-F26)/H26,0) |  | =IF(G26>J26,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D27/C27,0) |  | =IFERROR(F27/B27,0) |  | =IFERROR((H27-F27)/H27,0) |  | =IF(G27>J27,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D28/C28,0) |  | =IFERROR(F28/B28,0) |  | =IFERROR((H28-F28)/H28,0) |  | =IF(G28>J28,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D29/C29,0) |  | =IFERROR(F29/B29,0) |  | =IFERROR((H29-F29)/H29,0) |  | =IF(G29>J29,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D30/C30,0) |  | =IFERROR(F30/B30,0) |  | =IFERROR((H30-F30)/H30,0) |  | =IF(G30>J30,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D31/C31,0) |  | =IFERROR(F31/B31,0) |  | =IFERROR((H31-F31)/H31,0) |  | =IF(G31>J31,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D32/C32,0) |  | =IFERROR(F32/B32,0) |  | =IFERROR((H32-F32)/H32,0) |  | =IF(G32>J32,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D33/C33,0) |  | =IFERROR(F33/B33,0) |  | =IFERROR((H33-F33)/H33,0) |  | =IF(G33>J33,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D34/C34,0) |  | =IFERROR(F34/B34,0) |  | =IFERROR((H34-F34)/H34,0) |  | =IF(G34>J34,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D35/C35,0) |  | =IFERROR(F35/B35,0) |  | =IFERROR((H35-F35)/H35,0) |  | =IF(G35>J35,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D36/C36,0) |  | =IFERROR(F36/B36,0) |  | =IFERROR((H36-F36)/H36,0) |  | =IF(G36>J36,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D37/C37,0) |  | =IFERROR(F37/B37,0) |  | =IFERROR((H37-F37)/H37,0) |  | =IF(G37>J37,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D38/C38,0) |  | =IFERROR(F38/B38,0) |  | =IFERROR((H38-F38)/H38,0) |  | =IF(G38>J38,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D39/C39,0) |  | =IFERROR(F39/B39,0) |  | =IFERROR((H39-F39)/H39,0) |  | =IF(G39>J39,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D40/C40,0) |  | =IFERROR(F40/B40,0) |  | =IFERROR((H40-F40)/H40,0) |  | =IF(G40>J40,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D41/C41,0) |  | =IFERROR(F41/B41,0) |  | =IFERROR((H41-F41)/H41,0) |  | =IF(G41>J41,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D42/C42,0) |  | =IFERROR(F42/B42,0) |  | =IFERROR((H42-F42)/H42,0) |  | =IF(G42>J42,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D43/C43,0) |  | =IFERROR(F43/B43,0) |  | =IFERROR((H43-F43)/H43,0) |  | =IF(G43>J43,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D44/C44,0) |  | =IFERROR(F44/B44,0) |  | =IFERROR((H44-F44)/H44,0) |  | =IF(G44>J44,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D45/C45,0) |  | =IFERROR(F45/B45,0) |  | =IFERROR((H45-F45)/H45,0) |  | =IF(G45>J45,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D46/C46,0) |  | =IFERROR(F46/B46,0) |  | =IFERROR((H46-F46)/H46,0) |  | =IF(G46>J46,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D47/C47,0) |  | =IFERROR(F47/B47,0) |  | =IFERROR((H47-F47)/H47,0) |  | =IF(G47>J47,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D48/C48,0) |  | =IFERROR(F48/B48,0) |  | =IFERROR((H48-F48)/H48,0) |  | =IF(G48>J48,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D49/C49,0) |  | =IFERROR(F49/B49,0) |  | =IFERROR((H49-F49)/H49,0) |  | =IF(G49>J49,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D50/C50,0) |  | =IFERROR(F50/B50,0) |  | =IFERROR((H50-F50)/H50,0) |  | =IF(G50>J50,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D51/C51,0) |  | =IFERROR(F51/B51,0) |  | =IFERROR((H51-F51)/H51,0) |  | =IF(G51>J51,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D52/C52,0) |  | =IFERROR(F52/B52,0) |  | =IFERROR((H52-F52)/H52,0) |  | =IF(G52>J52,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D53/C53,0) |  | =IFERROR(F53/B53,0) |  | =IFERROR((H53-F53)/H53,0) |  | =IF(G53>J53,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D54/C54,0) |  | =IFERROR(F54/B54,0) |  | =IFERROR((H54-F54)/H54,0) |  | =IF(G54>J54,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D55/C55,0) |  | =IFERROR(F55/B55,0) |  | =IFERROR((H55-F55)/H55,0) |  | =IF(G55>J55,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D56/C56,0) |  | =IFERROR(F56/B56,0) |  | =IFERROR((H56-F56)/H56,0) |  | =IF(G56>J56,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D57/C57,0) |  | =IFERROR(F57/B57,0) |  | =IFERROR((H57-F57)/H57,0) |  | =IF(G57>J57,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D58/C58,0) |  | =IFERROR(F58/B58,0) |  | =IFERROR((H58-F58)/H58,0) |  | =IF(G58>J58,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D59/C59,0) |  | =IFERROR(F59/B59,0) |  | =IFERROR((H59-F59)/H59,0) |  | =IF(G59>J59,"Throttle / Upgrade","Within policy") |
|  |  |  |  | =IFERROR(D60/C60,0) |  | =IFERROR(F60/B60,0) |  | =IFERROR((H60-F60)/H60,0) |  | =IF(G60>J60,"Throttle / Upgrade","Within policy") |
... truncated at 60 of 100 rows

## Sheet: Module Economics  (100 rows x 12 cols)
| Module | Active Paying Tenants | Attach Rate | Recurring Revenue ($) | Usage Revenue ($) | Direct Delivery Cost ($) | Support / Maintenance ($) | Gross Profit ($) | Gross Margin | Build Investment ($) | Cumulative Gross Profit ($) | Recovery Months |
| Forecasting | 18 | 0.45 | 7200 | 1800 | 2200 | 1200 | =D2+E2-F2-G2 | =IFERROR(H2/(D2+E2),0) | 85000 | 26000 | =IFERROR((J2-K2)/H2,0) |
| Content Engine | 26 | 0.65 | 8400 | 2600 | 3100 | 1600 | =D3+E3-F3-G3 | =IFERROR(H3/(D3+E3),0) | 65000 | 34000 | =IFERROR((J3-K3)/H3,0) |
| Spreadsheet Studio | 12 | 0.3 | 3600 | 900 | 1100 | 700 | =D4+E4-F4-G4 | =IFERROR(H4/(D4+E4),0) | 42000 | 12000 | =IFERROR((J4-K4)/H4,0) |
| Cost Engine | 8 | 0.2 | 4000 | 300 | 900 | 650 | =D5+E5-F5-G5 | =IFERROR(H5/(D5+E5),0) | 95000 | 8500 | =IFERROR((J5-K5)/H5,0) |
|  |  |  |  |  |  |  | =D6+E6-F6-G6 | =IFERROR(H6/(D6+E6),0) |  |  | =IFERROR((J6-K6)/H6,0) |
|  |  |  |  |  |  |  | =D7+E7-F7-G7 | =IFERROR(H7/(D7+E7),0) |  |  | =IFERROR((J7-K7)/H7,0) |
|  |  |  |  |  |  |  | =D8+E8-F8-G8 | =IFERROR(H8/(D8+E8),0) |  |  | =IFERROR((J8-K8)/H8,0) |
|  |  |  |  |  |  |  | =D9+E9-F9-G9 | =IFERROR(H9/(D9+E9),0) |  |  | =IFERROR((J9-K9)/H9,0) |
|  |  |  |  |  |  |  | =D10+E10-F10-G10 | =IFERROR(H10/(D10+E10),0) |  |  | =IFERROR((J10-K10)/H10,0) |
|  |  |  |  |  |  |  | =D11+E11-F11-G11 | =IFERROR(H11/(D11+E11),0) |  |  | =IFERROR((J11-K11)/H11,0) |
|  |  |  |  |  |  |  | =D12+E12-F12-G12 | =IFERROR(H12/(D12+E12),0) |  |  | =IFERROR((J12-K12)/H12,0) |
|  |  |  |  |  |  |  | =D13+E13-F13-G13 | =IFERROR(H13/(D13+E13),0) |  |  | =IFERROR((J13-K13)/H13,0) |
|  |  |  |  |  |  |  | =D14+E14-F14-G14 | =IFERROR(H14/(D14+E14),0) |  |  | =IFERROR((J14-K14)/H14,0) |
|  |  |  |  |  |  |  | =D15+E15-F15-G15 | =IFERROR(H15/(D15+E15),0) |  |  | =IFERROR((J15-K15)/H15,0) |
|  |  |  |  |  |  |  | =D16+E16-F16-G16 | =IFERROR(H16/(D16+E16),0) |  |  | =IFERROR((J16-K16)/H16,0) |
|  |  |  |  |  |  |  | =D17+E17-F17-G17 | =IFERROR(H17/(D17+E17),0) |  |  | =IFERROR((J17-K17)/H17,0) |
|  |  |  |  |  |  |  | =D18+E18-F18-G18 | =IFERROR(H18/(D18+E18),0) |  |  | =IFERROR((J18-K18)/H18,0) |
|  |  |  |  |  |  |  | =D19+E19-F19-G19 | =IFERROR(H19/(D19+E19),0) |  |  | =IFERROR((J19-K19)/H19,0) |
|  |  |  |  |  |  |  | =D20+E20-F20-G20 | =IFERROR(H20/(D20+E20),0) |  |  | =IFERROR((J20-K20)/H20,0) |
|  |  |  |  |  |  |  | =D21+E21-F21-G21 | =IFERROR(H21/(D21+E21),0) |  |  | =IFERROR((J21-K21)/H21,0) |
|  |  |  |  |  |  |  | =D22+E22-F22-G22 | =IFERROR(H22/(D22+E22),0) |  |  | =IFERROR((J22-K22)/H22,0) |
|  |  |  |  |  |  |  | =D23+E23-F23-G23 | =IFERROR(H23/(D23+E23),0) |  |  | =IFERROR((J23-K23)/H23,0) |
|  |  |  |  |  |  |  | =D24+E24-F24-G24 | =IFERROR(H24/(D24+E24),0) |  |  | =IFERROR((J24-K24)/H24,0) |
|  |  |  |  |  |  |  | =D25+E25-F25-G25 | =IFERROR(H25/(D25+E25),0) |  |  | =IFERROR((J25-K25)/H25,0) |
|  |  |  |  |  |  |  | =D26+E26-F26-G26 | =IFERROR(H26/(D26+E26),0) |  |  | =IFERROR((J26-K26)/H26,0) |
|  |  |  |  |  |  |  | =D27+E27-F27-G27 | =IFERROR(H27/(D27+E27),0) |  |  | =IFERROR((J27-K27)/H27,0) |
|  |  |  |  |  |  |  | =D28+E28-F28-G28 | =IFERROR(H28/(D28+E28),0) |  |  | =IFERROR((J28-K28)/H28,0) |
|  |  |  |  |  |  |  | =D29+E29-F29-G29 | =IFERROR(H29/(D29+E29),0) |  |  | =IFERROR((J29-K29)/H29,0) |
|  |  |  |  |  |  |  | =D30+E30-F30-G30 | =IFERROR(H30/(D30+E30),0) |  |  | =IFERROR((J30-K30)/H30,0) |
|  |  |  |  |  |  |  | =D31+E31-F31-G31 | =IFERROR(H31/(D31+E31),0) |  |  | =IFERROR((J31-K31)/H31,0) |
|  |  |  |  |  |  |  | =D32+E32-F32-G32 | =IFERROR(H32/(D32+E32),0) |  |  | =IFERROR((J32-K32)/H32,0) |
|  |  |  |  |  |  |  | =D33+E33-F33-G33 | =IFERROR(H33/(D33+E33),0) |  |  | =IFERROR((J33-K33)/H33,0) |
|  |  |  |  |  |  |  | =D34+E34-F34-G34 | =IFERROR(H34/(D34+E34),0) |  |  | =IFERROR((J34-K34)/H34,0) |
|  |  |  |  |  |  |  | =D35+E35-F35-G35 | =IFERROR(H35/(D35+E35),0) |  |  | =IFERROR((J35-K35)/H35,0) |
|  |  |  |  |  |  |  | =D36+E36-F36-G36 | =IFERROR(H36/(D36+E36),0) |  |  | =IFERROR((J36-K36)/H36,0) |
|  |  |  |  |  |  |  | =D37+E37-F37-G37 | =IFERROR(H37/(D37+E37),0) |  |  | =IFERROR((J37-K37)/H37,0) |
|  |  |  |  |  |  |  | =D38+E38-F38-G38 | =IFERROR(H38/(D38+E38),0) |  |  | =IFERROR((J38-K38)/H38,0) |
|  |  |  |  |  |  |  | =D39+E39-F39-G39 | =IFERROR(H39/(D39+E39),0) |  |  | =IFERROR((J39-K39)/H39,0) |
|  |  |  |  |  |  |  | =D40+E40-F40-G40 | =IFERROR(H40/(D40+E40),0) |  |  | =IFERROR((J40-K40)/H40,0) |
|  |  |  |  |  |  |  | =D41+E41-F41-G41 | =IFERROR(H41/(D41+E41),0) |  |  | =IFERROR((J41-K41)/H41,0) |
|  |  |  |  |  |  |  | =D42+E42-F42-G42 | =IFERROR(H42/(D42+E42),0) |  |  | =IFERROR((J42-K42)/H42,0) |
|  |  |  |  |  |  |  | =D43+E43-F43-G43 | =IFERROR(H43/(D43+E43),0) |  |  | =IFERROR((J43-K43)/H43,0) |
|  |  |  |  |  |  |  | =D44+E44-F44-G44 | =IFERROR(H44/(D44+E44),0) |  |  | =IFERROR((J44-K44)/H44,0) |
|  |  |  |  |  |  |  | =D45+E45-F45-G45 | =IFERROR(H45/(D45+E45),0) |  |  | =IFERROR((J45-K45)/H45,0) |
|  |  |  |  |  |  |  | =D46+E46-F46-G46 | =IFERROR(H46/(D46+E46),0) |  |  | =IFERROR((J46-K46)/H46,0) |
|  |  |  |  |  |  |  | =D47+E47-F47-G47 | =IFERROR(H47/(D47+E47),0) |  |  | =IFERROR((J47-K47)/H47,0) |
|  |  |  |  |  |  |  | =D48+E48-F48-G48 | =IFERROR(H48/(D48+E48),0) |  |  | =IFERROR((J48-K48)/H48,0) |
|  |  |  |  |  |  |  | =D49+E49-F49-G49 | =IFERROR(H49/(D49+E49),0) |  |  | =IFERROR((J49-K49)/H49,0) |
|  |  |  |  |  |  |  | =D50+E50-F50-G50 | =IFERROR(H50/(D50+E50),0) |  |  | =IFERROR((J50-K50)/H50,0) |
|  |  |  |  |  |  |  | =D51+E51-F51-G51 | =IFERROR(H51/(D51+E51),0) |  |  | =IFERROR((J51-K51)/H51,0) |
|  |  |  |  |  |  |  | =D52+E52-F52-G52 | =IFERROR(H52/(D52+E52),0) |  |  | =IFERROR((J52-K52)/H52,0) |
|  |  |  |  |  |  |  | =D53+E53-F53-G53 | =IFERROR(H53/(D53+E53),0) |  |  | =IFERROR((J53-K53)/H53,0) |
|  |  |  |  |  |  |  | =D54+E54-F54-G54 | =IFERROR(H54/(D54+E54),0) |  |  | =IFERROR((J54-K54)/H54,0) |
|  |  |  |  |  |  |  | =D55+E55-F55-G55 | =IFERROR(H55/(D55+E55),0) |  |  | =IFERROR((J55-K55)/H55,0) |
|  |  |  |  |  |  |  | =D56+E56-F56-G56 | =IFERROR(H56/(D56+E56),0) |  |  | =IFERROR((J56-K56)/H56,0) |
|  |  |  |  |  |  |  | =D57+E57-F57-G57 | =IFERROR(H57/(D57+E57),0) |  |  | =IFERROR((J57-K57)/H57,0) |
|  |  |  |  |  |  |  | =D58+E58-F58-G58 | =IFERROR(H58/(D58+E58),0) |  |  | =IFERROR((J58-K58)/H58,0) |
|  |  |  |  |  |  |  | =D59+E59-F59-G59 | =IFERROR(H59/(D59+E59),0) |  |  | =IFERROR((J59-K59)/H59,0) |
|  |  |  |  |  |  |  | =D60+E60-F60-G60 | =IFERROR(H60/(D60+E60),0) |  |  | =IFERROR((J60-K60)/H60,0) |
... truncated at 60 of 100 rows

## Sheet: Revenue Recognition  (100 rows x 11 cols)
| Schedule ID | Tenant | Invoice Line | Recognition Method | Service Start | Service End | Recognized Revenue ($) | Deferred Revenue ($) | Currency | Policy Version | Status |
| RS-001 | Tenant A | INV-1001 | Ratable | 2026-07-01 00:00:00 | 2026-07-31 00:00:00 | 708 | 0 | USD | REV-1.0 | Posted |
| RS-002 | Tenant B | INV-1002 | Point in Time | 2026-07-15 00:00:00 | 2026-07-15 00:00:00 | 1400 | 0 | USD | REV-1.0 | Posted |
| RS-003 | Tenant A | INV-1003 | Usage | 2026-07-01 00:00:00 | 2026-07-31 00:00:00 | 180 | 0 | USD | REV-1.0 | Posted |
| RS-004 | Tenant D | INV-1004 | Ratable | 2026-07-01 00:00:00 | 2027-06-30 00:00:00 | 2000 | 22000 | USD | REV-1.0 | Open |
... truncated at 60 of 100 rows

## Sheet: Capital Investment  (100 rows x 13 cols)
| Project Code | Project / Module | Status | Assessment | In-Service Date | Qualifying Build Cost ($) | Expensed Build Cost ($) | Useful Life (Months) | Monthly Amortization ($) | Accumulated Amortization ($) | Carrying Amount ($) | Annual Gross Profit ($) | Investment Recovery (Months) |
| CAP-001 | Forecasting v2 | In Service | Capitalized | 2026-04-01 00:00:00 | 50000 | 35000 | 36 | =IFERROR(F2/H2,0) | 5555.56 | =MAX(0,F2-J2) | 31200 | =IFERROR(K2/(L2/12),0) |
| CAP-002 | Content Engine Rewrite | Work in Progress | Candidate |  | 40000 | 25000 | 36 | =IFERROR(F3/H3,0) | 0 | =MAX(0,F3-J3) | 40800 | =IFERROR(K3/(L3/12),0) |
| CAP-003 | Cost Engine | In Service | Capitalized | 2026-07-01 00:00:00 | 70000 | 25000 | 48 | =IFERROR(F4/H4,0) | 1458.33 | =MAX(0,F4-J4) | 10200 | =IFERROR(K4/(L4/12),0) |
| CAP-004 | Client Custom Workflow | Rejected | Expense | 2026-06-01 00:00:00 | 0 | 18000 | 0 | =IFERROR(F5/H5,0) | 0 | =MAX(0,F5-J5) | 6500 | =IFERROR(K5/(L5/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F6/H6,0) |  | =MAX(0,F6-J6) |  | =IFERROR(K6/(L6/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F7/H7,0) |  | =MAX(0,F7-J7) |  | =IFERROR(K7/(L7/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F8/H8,0) |  | =MAX(0,F8-J8) |  | =IFERROR(K8/(L8/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F9/H9,0) |  | =MAX(0,F9-J9) |  | =IFERROR(K9/(L9/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F10/H10,0) |  | =MAX(0,F10-J10) |  | =IFERROR(K10/(L10/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F11/H11,0) |  | =MAX(0,F11-J11) |  | =IFERROR(K11/(L11/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F12/H12,0) |  | =MAX(0,F12-J12) |  | =IFERROR(K12/(L12/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F13/H13,0) |  | =MAX(0,F13-J13) |  | =IFERROR(K13/(L13/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F14/H14,0) |  | =MAX(0,F14-J14) |  | =IFERROR(K14/(L14/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F15/H15,0) |  | =MAX(0,F15-J15) |  | =IFERROR(K15/(L15/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F16/H16,0) |  | =MAX(0,F16-J16) |  | =IFERROR(K16/(L16/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F17/H17,0) |  | =MAX(0,F17-J17) |  | =IFERROR(K17/(L17/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F18/H18,0) |  | =MAX(0,F18-J18) |  | =IFERROR(K18/(L18/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F19/H19,0) |  | =MAX(0,F19-J19) |  | =IFERROR(K19/(L19/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F20/H20,0) |  | =MAX(0,F20-J20) |  | =IFERROR(K20/(L20/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F21/H21,0) |  | =MAX(0,F21-J21) |  | =IFERROR(K21/(L21/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F22/H22,0) |  | =MAX(0,F22-J22) |  | =IFERROR(K22/(L22/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F23/H23,0) |  | =MAX(0,F23-J23) |  | =IFERROR(K23/(L23/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F24/H24,0) |  | =MAX(0,F24-J24) |  | =IFERROR(K24/(L24/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F25/H25,0) |  | =MAX(0,F25-J25) |  | =IFERROR(K25/(L25/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F26/H26,0) |  | =MAX(0,F26-J26) |  | =IFERROR(K26/(L26/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F27/H27,0) |  | =MAX(0,F27-J27) |  | =IFERROR(K27/(L27/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F28/H28,0) |  | =MAX(0,F28-J28) |  | =IFERROR(K28/(L28/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F29/H29,0) |  | =MAX(0,F29-J29) |  | =IFERROR(K29/(L29/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F30/H30,0) |  | =MAX(0,F30-J30) |  | =IFERROR(K30/(L30/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F31/H31,0) |  | =MAX(0,F31-J31) |  | =IFERROR(K31/(L31/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F32/H32,0) |  | =MAX(0,F32-J32) |  | =IFERROR(K32/(L32/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F33/H33,0) |  | =MAX(0,F33-J33) |  | =IFERROR(K33/(L33/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F34/H34,0) |  | =MAX(0,F34-J34) |  | =IFERROR(K34/(L34/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F35/H35,0) |  | =MAX(0,F35-J35) |  | =IFERROR(K35/(L35/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F36/H36,0) |  | =MAX(0,F36-J36) |  | =IFERROR(K36/(L36/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F37/H37,0) |  | =MAX(0,F37-J37) |  | =IFERROR(K37/(L37/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F38/H38,0) |  | =MAX(0,F38-J38) |  | =IFERROR(K38/(L38/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F39/H39,0) |  | =MAX(0,F39-J39) |  | =IFERROR(K39/(L39/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F40/H40,0) |  | =MAX(0,F40-J40) |  | =IFERROR(K40/(L40/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F41/H41,0) |  | =MAX(0,F41-J41) |  | =IFERROR(K41/(L41/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F42/H42,0) |  | =MAX(0,F42-J42) |  | =IFERROR(K42/(L42/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F43/H43,0) |  | =MAX(0,F43-J43) |  | =IFERROR(K43/(L43/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F44/H44,0) |  | =MAX(0,F44-J44) |  | =IFERROR(K44/(L44/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F45/H45,0) |  | =MAX(0,F45-J45) |  | =IFERROR(K45/(L45/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F46/H46,0) |  | =MAX(0,F46-J46) |  | =IFERROR(K46/(L46/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F47/H47,0) |  | =MAX(0,F47-J47) |  | =IFERROR(K47/(L47/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F48/H48,0) |  | =MAX(0,F48-J48) |  | =IFERROR(K48/(L48/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F49/H49,0) |  | =MAX(0,F49-J49) |  | =IFERROR(K49/(L49/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F50/H50,0) |  | =MAX(0,F50-J50) |  | =IFERROR(K50/(L50/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F51/H51,0) |  | =MAX(0,F51-J51) |  | =IFERROR(K51/(L51/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F52/H52,0) |  | =MAX(0,F52-J52) |  | =IFERROR(K52/(L52/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F53/H53,0) |  | =MAX(0,F53-J53) |  | =IFERROR(K53/(L53/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F54/H54,0) |  | =MAX(0,F54-J54) |  | =IFERROR(K54/(L54/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F55/H55,0) |  | =MAX(0,F55-J55) |  | =IFERROR(K55/(L55/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F56/H56,0) |  | =MAX(0,F56-J56) |  | =IFERROR(K56/(L56/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F57/H57,0) |  | =MAX(0,F57-J57) |  | =IFERROR(K57/(L57/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F58/H58,0) |  | =MAX(0,F58-J58) |  | =IFERROR(K58/(L58/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F59/H59,0) |  | =MAX(0,F59-J59) |  | =IFERROR(K59/(L59/12),0) |
|  |  |  |  |  |  |  |  | =IFERROR(F60/H60,0) |  | =MAX(0,F60-J60) |  | =IFERROR(K60/(L60/12),0) |
... truncated at 60 of 100 rows

## Sheet: Assumptions  (100 rows x 6 cols)
| Commercial and Financial Assumptions |  |  |  |  |  |
| Assumption | Value | Unit | Owner | Last Updated | Source / Note |
| Target gross margin | 0.7 | % | Commercial | 2026-07-28 00:00:00 | Management policy |
| Minimum gross margin | 0.6 | % | CFO | 2026-07-28 00:00:00 | Deal approval threshold |
| AI cost markup | 0.5 | % | Commercial | 2026-07-28 00:00:00 | Illustrative cost-plus control |
| Payment loss / fees | 0.03 | % | Finance | 2026-07-28 00:00:00 | Illustrative |
| Free tenant monthly ceiling | 10 | USD | Growth | 2026-07-28 00:00:00 | Free-plan policy |
| Default build useful life | 36 | Months | Finance | 2026-07-28 00:00:00 | Subject to accounting policy |
| Target build recovery | 36 | Months | Product | 2026-07-28 00:00:00 | Management target |
... truncated at 60 of 100 rows

## Sheet: Data Dictionary  (100 rows x 6 cols)
| Entity / Sheet | Field | Definition | Required | Source of Truth | Governance Note |
| Plans & Packages | Product Version | Effective version of a sellable plan, module, package or service | Yes | Product catalogue | Never overwrite an active historic version |
| Pricing Components | Price Model | Flat, per-unit, tiered, package, cost-plus or custom pricing | Yes | Pricing service | Effective dated and approved |
| Customer Contracts | Custom Price | Negotiated customer price | Conditional | Signed contract / deal desk | Must not silently inherit future list changes |
| Usage & Billing | Net Billable | Rated amount after included units, credits and discounts | Yes | Rating engine | Reproducible calculation trace required |
| Customer Economics | Gross Margin | Customer revenue less directly attributable delivery cost | Yes | Revenue + cost engines | Do not mix with contribution margin |
| Free Plan | Shadow Revenue | Internal economic value of free usage at standard price | Yes | Pricing engine | Never invoiced unless converted |
| Capital Investment | Qualifying Build Cost | Development cost approved for capitalization under policy | Conditional | Capital asset subledger | Accounting approval required |
| Revenue Recognition | Recognized Revenue | Revenue posted according to performance obligation | Yes | Revenue ledger | Not identical to invoice or cash |
... truncated at 60 of 100 rows