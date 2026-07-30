# Extracted from 41361ff1-enterprise_cost_governance_model.xlsx (structure + formulas; original xlsx retained by PBS)

## Sheet: Dashboard  (15 rows x 10 cols)
| Enterprise Cost Governance Dashboard |  |  |  |  |  |  |  |  |  |
| Illustrative model — connect formulas to Supabase views in production |  |  |  |  |  |  |  |  |  |
| Actual Cost |  | Budget |  | Variance |  | AI Cost |  | Unallocated % |  |
|  | =SUM('Cost Ledger'!$M$2:$M$200) |  | =SUM(Budgets!$F$2:$F$100) |  | =B6-D6 |  | =SUMIF('Cost Ledger'!$G$2:$G$200,"ai_inference",'Cost Ledger'!$M$2:$M$200) |  | =IFERROR(SUMIF('Cost Ledger'!$I$2:$I$200,"Unallocated",'Cost Ledger'!$M$2:$M$200 |
| Cost by Work Class |  |  |  |  |  | Governance Status |  |  |  |
| Work Class | Actual Cost ($) |  |  |  |  | Control | Status | Threshold | Observed |
| Platform Operations | =SUMIF('Cost Ledger'!$H$2:$H$200,"platform_operations",'Cost Ledger'!$M$2:$M$200 |  |  |  |  | Unallocated cost | Formula | 0.02 | =J6 |
| Platform Build | =SUMIF('Cost Ledger'!$H$2:$H$200,"platform_build",'Cost Ledger'!$M$2:$M$200) |  |  |  |  | Budget variance | Formula | 0.1 | =IFERROR(ABS(F6/D6),0) |
| Tenant Operations | =SUMIF('Cost Ledger'!$H$2:$H$200,"tenant_operations",'Cost Ledger'!$M$2:$M$200) |  |  |  |  | Failed AI cost | Formula | 0.03 | =IFERROR(SUMIFS('Cost Ledger'!$M$2:$M$200,'Cost Ledger'!$G$2:$G$200,"ai_inferenc |
| Client Special Request | =SUMIF('Cost Ledger'!$H$2:$H$200,"client_special_request",'Cost Ledger'!$M$2:$M$ |  |  |  |  | Special requests without approval | Formula | 0 | =COUNTIFS('Task Costing'!$E$2:$E$100,"client_special_request",'Task Costing'!$L$ |
| Other | =MAX(0,$B$6-SUM(B11:B14)) |  |  |  |  | Closed-period changes | Manual | 0 | 0 |

## Sheet: Cost Ledger  (200 rows x 16 cols)
| Event ID | Posting Date | Tenant | Module | Project / Request | Source Type | Cost Nature | Work Class | Attribution | Provider | Quantity | Unit | Amount ($) | Status | Idempotency Key | Run Status |
| CE-0001 | 2026-07-01 00:00:00 | Tenant A | Forecasting | Monthly Forecast | AI Usage | ai_inference | tenant_operations | Direct | Provider A | 180000 | tokens | 3.6 | Posted | idem-001 | Succeeded |
| CE-0002 | 2026-07-01 00:00:00 | Shared | Platform | Vercel Hosting | Invoice | cloud_compute | platform_operations | Usage Allocation | Vercel | 1 | month | 420 | Posted | idem-002 | Succeeded |
| CE-0003 | 2026-07-02 00:00:00 | Tenant B | Content Engine | Custom Campaign | AI Usage | ai_inference | client_special_request | Direct | Provider B | 65000 | tokens | 1.95 | Posted | idem-003 | Succeeded |
| CE-0004 | 2026-07-03 00:00:00 | Shared | Cost Engine | Module Build | Time Record | human_labor | platform_build | Direct | Internal | 18 | hours | 1440 | Posted | idem-004 | Succeeded |
| CE-0005 | 2026-07-04 00:00:00 | Tenant A | Reporting | Daily Refresh | AI Usage | ai_inference | tenant_operations | Direct | Provider A | 90000 | tokens | 1.8 | Posted | idem-005 | Failed |
| CE-0006 | 2026-07-05 00:00:00 | Shared | Database | Supabase | Invoice | database | platform_operations | Unallocated | Supabase | 1 | month | 680 | Posted | idem-006 | Succeeded |
... truncated at 60 of 200 rows

## Sheet: Task Costing  (100 rows x 15 cols)
| Task Run ID | Tenant | Module | Task Type | Work Class | Project / Request | Estimated Cost ($) | Actual AI ($) | Actual Infra ($) | Actual Human ($) | Total Actual ($) | Approval | Variance ($) | Variance % | Status |
| TR-001 | Tenant A | Forecasting | Monthly Forecast | tenant_operations | Monthly Forecast | 5 | 3.6 | 0.8 | 0 | =SUM(H2:J2) | Approved | =K2-G2 | =IFERROR(M2/G2,0) | Succeeded |
| TR-002 | Tenant B | Content Engine | Custom Campaign | client_special_request | CR-2026-014 | 120 | 1.95 | 3 | 80 | =SUM(H3:J3) | Approved | =K3-G3 | =IFERROR(M3/G3,0) | Succeeded |
| TR-003 | Shared | Cost Engine | Module Development | platform_build | Cost Engine v1 | 1800 | 25 | 15 | 1440 | =SUM(H4:J4) | Approved | =K4-G4 | =IFERROR(M4/G4,0) | In Progress |
| TR-004 | Tenant A | Reporting | Daily Refresh | tenant_operations | Daily Refresh | 2 | 1.8 | 0.4 | 0 | =SUM(H5:J5) | Approved | =K5-G5 | =IFERROR(M5/G5,0) | Failed |
|  |  |  |  |  |  |  |  |  |  | =SUM(H6:J6) |  | =K6-G6 | =IFERROR(M6/G6,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H7:J7) |  | =K7-G7 | =IFERROR(M7/G7,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H8:J8) |  | =K8-G8 | =IFERROR(M8/G8,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H9:J9) |  | =K9-G9 | =IFERROR(M9/G9,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H10:J10) |  | =K10-G10 | =IFERROR(M10/G10,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H11:J11) |  | =K11-G11 | =IFERROR(M11/G11,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H12:J12) |  | =K12-G12 | =IFERROR(M12/G12,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H13:J13) |  | =K13-G13 | =IFERROR(M13/G13,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H14:J14) |  | =K14-G14 | =IFERROR(M14/G14,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H15:J15) |  | =K15-G15 | =IFERROR(M15/G15,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H16:J16) |  | =K16-G16 | =IFERROR(M16/G16,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H17:J17) |  | =K17-G17 | =IFERROR(M17/G17,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H18:J18) |  | =K18-G18 | =IFERROR(M18/G18,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H19:J19) |  | =K19-G19 | =IFERROR(M19/G19,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H20:J20) |  | =K20-G20 | =IFERROR(M20/G20,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H21:J21) |  | =K21-G21 | =IFERROR(M21/G21,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H22:J22) |  | =K22-G22 | =IFERROR(M22/G22,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H23:J23) |  | =K23-G23 | =IFERROR(M23/G23,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H24:J24) |  | =K24-G24 | =IFERROR(M24/G24,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H25:J25) |  | =K25-G25 | =IFERROR(M25/G25,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H26:J26) |  | =K26-G26 | =IFERROR(M26/G26,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H27:J27) |  | =K27-G27 | =IFERROR(M27/G27,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H28:J28) |  | =K28-G28 | =IFERROR(M28/G28,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H29:J29) |  | =K29-G29 | =IFERROR(M29/G29,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H30:J30) |  | =K30-G30 | =IFERROR(M30/G30,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H31:J31) |  | =K31-G31 | =IFERROR(M31/G31,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H32:J32) |  | =K32-G32 | =IFERROR(M32/G32,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H33:J33) |  | =K33-G33 | =IFERROR(M33/G33,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H34:J34) |  | =K34-G34 | =IFERROR(M34/G34,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H35:J35) |  | =K35-G35 | =IFERROR(M35/G35,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H36:J36) |  | =K36-G36 | =IFERROR(M36/G36,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H37:J37) |  | =K37-G37 | =IFERROR(M37/G37,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H38:J38) |  | =K38-G38 | =IFERROR(M38/G38,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H39:J39) |  | =K39-G39 | =IFERROR(M39/G39,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H40:J40) |  | =K40-G40 | =IFERROR(M40/G40,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H41:J41) |  | =K41-G41 | =IFERROR(M41/G41,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H42:J42) |  | =K42-G42 | =IFERROR(M42/G42,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H43:J43) |  | =K43-G43 | =IFERROR(M43/G43,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H44:J44) |  | =K44-G44 | =IFERROR(M44/G44,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H45:J45) |  | =K45-G45 | =IFERROR(M45/G45,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H46:J46) |  | =K46-G46 | =IFERROR(M46/G46,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H47:J47) |  | =K47-G47 | =IFERROR(M47/G47,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H48:J48) |  | =K48-G48 | =IFERROR(M48/G48,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H49:J49) |  | =K49-G49 | =IFERROR(M49/G49,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H50:J50) |  | =K50-G50 | =IFERROR(M50/G50,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H51:J51) |  | =K51-G51 | =IFERROR(M51/G51,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H52:J52) |  | =K52-G52 | =IFERROR(M52/G52,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H53:J53) |  | =K53-G53 | =IFERROR(M53/G53,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H54:J54) |  | =K54-G54 | =IFERROR(M54/G54,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H55:J55) |  | =K55-G55 | =IFERROR(M55/G55,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H56:J56) |  | =K56-G56 | =IFERROR(M56/G56,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H57:J57) |  | =K57-G57 | =IFERROR(M57/G57,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H58:J58) |  | =K58-G58 | =IFERROR(M58/G58,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H59:J59) |  | =K59-G59 | =IFERROR(M59/G59,0) |  |
|  |  |  |  |  |  |  |  |  |  | =SUM(H60:J60) |  | =K60-G60 | =IFERROR(M60/G60,0) |  |
... truncated at 60 of 100 rows

## Sheet: AI Runs  (100 rows x 14 cols)
| Usage Event | Task Run | Tenant | Provider | Model | Input Units | Cached Input | Output Units | Tool Units | Price Version | Calculated Cost ($) | Latency (ms) | Retry | Succeeded |
| AI-001 | TR-001 | Tenant A | Provider A | Model X | 120000 | 10000 | 60000 | 2 | 2026-07 | 3.6 | 4200 | 0 | True |
| AI-002 | TR-002 | Tenant B | Provider B | Model Y | 45000 | 0 | 20000 | 1 | 2026-07 | 1.95 | 2800 | 0 | True |
| AI-003 | TR-004 | Tenant A | Provider A | Model X | 60000 | 0 | 30000 | 3 | 2026-07 | 1.8 | 8500 | 1 | False |
... truncated at 60 of 100 rows

## Sheet: Allocation Rules  (100 rows x 10 cols)
| Policy ID | Policy Name | Version | Basis | Effective From | Effective To | Source Cost Pool | Target Dimension | Weight / Rule | Approval Status |
| ALLOC-001 | Vercel Shared Compute | 1.0.0 | task_count | 2026-07-01 00:00:00 |  | Vercel | Tenant | Pro rata by completed task count | Approved |
| ALLOC-002 | Supabase Shared Database | 1.0.0 | storage_share | 2026-07-01 00:00:00 |  | Supabase | Tenant | Pro rata by measured storage GB | Approved |
| ALLOC-003 | Platform Support | 1.0.0 | hybrid | 2026-07-01 00:00:00 |  | Support | Tenant | 50% equal + 50% task count | Draft |
... truncated at 60 of 100 rows

## Sheet: Budgets  (100 rows x 11 cols)
| Budget ID | Scope Type | Scope | Period Start | Period End | Budget Amount ($) | Version | Status | Actual ($) | Variance ($) | Variance % |
| BUD-001 | Enterprise | All | 2026-07-01 00:00:00 | 2026-07-31 00:00:00 | 4000 | 1.0 | Approved | =SUM('Cost Ledger'!$M$2:$M$200) | =I2-F2 | =IFERROR(J2/F2,0) |
| BUD-002 | Module | Cost Engine | 2026-07-01 00:00:00 | 2026-07-31 00:00:00 | 2000 | 1.0 | Approved | =SUMIF('Cost Ledger'!$D$2:$D$200,"Cost Engine",'Cost Ledger'!$M$2:$M$200) | =I3-F3 | =IFERROR(J3/F3,0) |
| BUD-003 | Tenant | Tenant A | 2026-07-01 00:00:00 | 2026-07-31 00:00:00 | 500 | 1.0 | Approved | =SUMIF('Cost Ledger'!$C$2:$C$200,"Tenant A",'Cost Ledger'!$M$2:$M$200) | =I4-F4 | =IFERROR(J4/F4,0) |
|  |  |  |  |  |  |  |  |  | =I5-F5 | =IFERROR(J5/F5,0) |
|  |  |  |  |  |  |  |  |  | =I6-F6 | =IFERROR(J6/F6,0) |
|  |  |  |  |  |  |  |  |  | =I7-F7 | =IFERROR(J7/F7,0) |
|  |  |  |  |  |  |  |  |  | =I8-F8 | =IFERROR(J8/F8,0) |
|  |  |  |  |  |  |  |  |  | =I9-F9 | =IFERROR(J9/F9,0) |
|  |  |  |  |  |  |  |  |  | =I10-F10 | =IFERROR(J10/F10,0) |
|  |  |  |  |  |  |  |  |  | =I11-F11 | =IFERROR(J11/F11,0) |
|  |  |  |  |  |  |  |  |  | =I12-F12 | =IFERROR(J12/F12,0) |
|  |  |  |  |  |  |  |  |  | =I13-F13 | =IFERROR(J13/F13,0) |
|  |  |  |  |  |  |  |  |  | =I14-F14 | =IFERROR(J14/F14,0) |
|  |  |  |  |  |  |  |  |  | =I15-F15 | =IFERROR(J15/F15,0) |
|  |  |  |  |  |  |  |  |  | =I16-F16 | =IFERROR(J16/F16,0) |
|  |  |  |  |  |  |  |  |  | =I17-F17 | =IFERROR(J17/F17,0) |
|  |  |  |  |  |  |  |  |  | =I18-F18 | =IFERROR(J18/F18,0) |
|  |  |  |  |  |  |  |  |  | =I19-F19 | =IFERROR(J19/F19,0) |
|  |  |  |  |  |  |  |  |  | =I20-F20 | =IFERROR(J20/F20,0) |
|  |  |  |  |  |  |  |  |  | =I21-F21 | =IFERROR(J21/F21,0) |
|  |  |  |  |  |  |  |  |  | =I22-F22 | =IFERROR(J22/F22,0) |
|  |  |  |  |  |  |  |  |  | =I23-F23 | =IFERROR(J23/F23,0) |
|  |  |  |  |  |  |  |  |  | =I24-F24 | =IFERROR(J24/F24,0) |
|  |  |  |  |  |  |  |  |  | =I25-F25 | =IFERROR(J25/F25,0) |
|  |  |  |  |  |  |  |  |  | =I26-F26 | =IFERROR(J26/F26,0) |
|  |  |  |  |  |  |  |  |  | =I27-F27 | =IFERROR(J27/F27,0) |
|  |  |  |  |  |  |  |  |  | =I28-F28 | =IFERROR(J28/F28,0) |
|  |  |  |  |  |  |  |  |  | =I29-F29 | =IFERROR(J29/F29,0) |
|  |  |  |  |  |  |  |  |  | =I30-F30 | =IFERROR(J30/F30,0) |
|  |  |  |  |  |  |  |  |  | =I31-F31 | =IFERROR(J31/F31,0) |
|  |  |  |  |  |  |  |  |  | =I32-F32 | =IFERROR(J32/F32,0) |
|  |  |  |  |  |  |  |  |  | =I33-F33 | =IFERROR(J33/F33,0) |
|  |  |  |  |  |  |  |  |  | =I34-F34 | =IFERROR(J34/F34,0) |
|  |  |  |  |  |  |  |  |  | =I35-F35 | =IFERROR(J35/F35,0) |
|  |  |  |  |  |  |  |  |  | =I36-F36 | =IFERROR(J36/F36,0) |
|  |  |  |  |  |  |  |  |  | =I37-F37 | =IFERROR(J37/F37,0) |
|  |  |  |  |  |  |  |  |  | =I38-F38 | =IFERROR(J38/F38,0) |
|  |  |  |  |  |  |  |  |  | =I39-F39 | =IFERROR(J39/F39,0) |
|  |  |  |  |  |  |  |  |  | =I40-F40 | =IFERROR(J40/F40,0) |
|  |  |  |  |  |  |  |  |  | =I41-F41 | =IFERROR(J41/F41,0) |
|  |  |  |  |  |  |  |  |  | =I42-F42 | =IFERROR(J42/F42,0) |
|  |  |  |  |  |  |  |  |  | =I43-F43 | =IFERROR(J43/F43,0) |
|  |  |  |  |  |  |  |  |  | =I44-F44 | =IFERROR(J44/F44,0) |
|  |  |  |  |  |  |  |  |  | =I45-F45 | =IFERROR(J45/F45,0) |
|  |  |  |  |  |  |  |  |  | =I46-F46 | =IFERROR(J46/F46,0) |
|  |  |  |  |  |  |  |  |  | =I47-F47 | =IFERROR(J47/F47,0) |
|  |  |  |  |  |  |  |  |  | =I48-F48 | =IFERROR(J48/F48,0) |
|  |  |  |  |  |  |  |  |  | =I49-F49 | =IFERROR(J49/F49,0) |
|  |  |  |  |  |  |  |  |  | =I50-F50 | =IFERROR(J50/F50,0) |
|  |  |  |  |  |  |  |  |  | =I51-F51 | =IFERROR(J51/F51,0) |
|  |  |  |  |  |  |  |  |  | =I52-F52 | =IFERROR(J52/F52,0) |
|  |  |  |  |  |  |  |  |  | =I53-F53 | =IFERROR(J53/F53,0) |
|  |  |  |  |  |  |  |  |  | =I54-F54 | =IFERROR(J54/F54,0) |
|  |  |  |  |  |  |  |  |  | =I55-F55 | =IFERROR(J55/F55,0) |
|  |  |  |  |  |  |  |  |  | =I56-F56 | =IFERROR(J56/F56,0) |
|  |  |  |  |  |  |  |  |  | =I57-F57 | =IFERROR(J57/F57,0) |
|  |  |  |  |  |  |  |  |  | =I58-F58 | =IFERROR(J58/F58,0) |
|  |  |  |  |  |  |  |  |  | =I59-F59 | =IFERROR(J59/F59,0) |
|  |  |  |  |  |  |  |  |  | =I60-F60 | =IFERROR(J60/F60,0) |
... truncated at 60 of 100 rows

## Sheet: Tenant Unit Economics  (100 rows x 11 cols)
| Tenant | Direct AI ($) | Direct Infra ($) | Human / Support ($) | Allocated Shared ($) | Total Cost ($) | Revenue ($) | Contribution ($) | Contribution Margin | Completed Tasks | Cost / Task ($) |
| Tenant A | =SUMIFS('Cost Ledger'!$M$2:$M$200,'Cost Ledger'!$C$2:$C$200,A2,'Cost Ledger'!$G$ | =SUMIFS('Cost Ledger'!$M$2:$M$200,'Cost Ledger'!$C$2:$C$200,A2,'Cost Ledger'!$G$ | =SUMIFS('Cost Ledger'!$M$2:$M$200,'Cost Ledger'!$C$2:$C$200,A2,'Cost Ledger'!$G$ | 0 | =SUM(B2:E2) | 1000 | =G2-F2 | =IFERROR(H2/G2,0) | =COUNTIFS('Task Costing'!$B$2:$B$100,A2,'Task Costing'!$O$2:$O$100,"Succeeded") | =IFERROR(F2/J2,0) |
| Tenant B | =SUMIFS('Cost Ledger'!$M$2:$M$200,'Cost Ledger'!$C$2:$C$200,A3,'Cost Ledger'!$G$ | =SUMIFS('Cost Ledger'!$M$2:$M$200,'Cost Ledger'!$C$2:$C$200,A3,'Cost Ledger'!$G$ | =SUMIFS('Cost Ledger'!$M$2:$M$200,'Cost Ledger'!$C$2:$C$200,A3,'Cost Ledger'!$G$ | 0 | =SUM(B3:E3) | 750 | =G3-F3 | =IFERROR(H3/G3,0) | =COUNTIFS('Task Costing'!$B$2:$B$100,A3,'Task Costing'!$O$2:$O$100,"Succeeded") | =IFERROR(F3/J3,0) |
| Shared / Platform | =SUMIFS('Cost Ledger'!$M$2:$M$200,'Cost Ledger'!$C$2:$C$200,A4,'Cost Ledger'!$G$ | =SUMIFS('Cost Ledger'!$M$2:$M$200,'Cost Ledger'!$C$2:$C$200,A4,'Cost Ledger'!$G$ | =SUMIFS('Cost Ledger'!$M$2:$M$200,'Cost Ledger'!$C$2:$C$200,A4,'Cost Ledger'!$G$ | 0 | =SUM(B4:E4) | 0 | =G4-F4 | =IFERROR(H4/G4,0) | =COUNTIFS('Task Costing'!$B$2:$B$100,A4,'Task Costing'!$O$2:$O$100,"Succeeded") | =IFERROR(F4/J4,0) |
... truncated at 60 of 100 rows

## Sheet: Chargeback  (100 rows x 9 cols)
| Charge ID | Tenant | Billing Period | Source Cost ($) | Billing Method | Markup % | Charge Amount ($) | Status | Invoice Reference |
| CHG-001 | Tenant A | 2026-07-01 00:00:00 | 5.8 | Pass-through | 0 | =D2*(1+F2) | Draft |  |
| CHG-002 | Tenant B | 2026-07-01 00:00:00 | 84.95 | Cost plus | 0.2 | =D3*(1+F3) | Draft |  |
|  |  |  |  |  |  | =D4*(1+F4) |  |  |
|  |  |  |  |  |  | =D5*(1+F5) |  |  |
|  |  |  |  |  |  | =D6*(1+F6) |  |  |
|  |  |  |  |  |  | =D7*(1+F7) |  |  |
|  |  |  |  |  |  | =D8*(1+F8) |  |  |
|  |  |  |  |  |  | =D9*(1+F9) |  |  |
|  |  |  |  |  |  | =D10*(1+F10) |  |  |
|  |  |  |  |  |  | =D11*(1+F11) |  |  |
|  |  |  |  |  |  | =D12*(1+F12) |  |  |
|  |  |  |  |  |  | =D13*(1+F13) |  |  |
|  |  |  |  |  |  | =D14*(1+F14) |  |  |
|  |  |  |  |  |  | =D15*(1+F15) |  |  |
|  |  |  |  |  |  | =D16*(1+F16) |  |  |
|  |  |  |  |  |  | =D17*(1+F17) |  |  |
|  |  |  |  |  |  | =D18*(1+F18) |  |  |
|  |  |  |  |  |  | =D19*(1+F19) |  |  |
|  |  |  |  |  |  | =D20*(1+F20) |  |  |
|  |  |  |  |  |  | =D21*(1+F21) |  |  |
|  |  |  |  |  |  | =D22*(1+F22) |  |  |
|  |  |  |  |  |  | =D23*(1+F23) |  |  |
|  |  |  |  |  |  | =D24*(1+F24) |  |  |
|  |  |  |  |  |  | =D25*(1+F25) |  |  |
|  |  |  |  |  |  | =D26*(1+F26) |  |  |
|  |  |  |  |  |  | =D27*(1+F27) |  |  |
|  |  |  |  |  |  | =D28*(1+F28) |  |  |
|  |  |  |  |  |  | =D29*(1+F29) |  |  |
|  |  |  |  |  |  | =D30*(1+F30) |  |  |
|  |  |  |  |  |  | =D31*(1+F31) |  |  |
|  |  |  |  |  |  | =D32*(1+F32) |  |  |
|  |  |  |  |  |  | =D33*(1+F33) |  |  |
|  |  |  |  |  |  | =D34*(1+F34) |  |  |
|  |  |  |  |  |  | =D35*(1+F35) |  |  |
|  |  |  |  |  |  | =D36*(1+F36) |  |  |
|  |  |  |  |  |  | =D37*(1+F37) |  |  |
|  |  |  |  |  |  | =D38*(1+F38) |  |  |
|  |  |  |  |  |  | =D39*(1+F39) |  |  |
|  |  |  |  |  |  | =D40*(1+F40) |  |  |
|  |  |  |  |  |  | =D41*(1+F41) |  |  |
|  |  |  |  |  |  | =D42*(1+F42) |  |  |
|  |  |  |  |  |  | =D43*(1+F43) |  |  |
|  |  |  |  |  |  | =D44*(1+F44) |  |  |
|  |  |  |  |  |  | =D45*(1+F45) |  |  |
|  |  |  |  |  |  | =D46*(1+F46) |  |  |
|  |  |  |  |  |  | =D47*(1+F47) |  |  |
|  |  |  |  |  |  | =D48*(1+F48) |  |  |
|  |  |  |  |  |  | =D49*(1+F49) |  |  |
|  |  |  |  |  |  | =D50*(1+F50) |  |  |
|  |  |  |  |  |  | =D51*(1+F51) |  |  |
|  |  |  |  |  |  | =D52*(1+F52) |  |  |
|  |  |  |  |  |  | =D53*(1+F53) |  |  |
|  |  |  |  |  |  | =D54*(1+F54) |  |  |
|  |  |  |  |  |  | =D55*(1+F55) |  |  |
|  |  |  |  |  |  | =D56*(1+F56) |  |  |
|  |  |  |  |  |  | =D57*(1+F57) |  |  |
|  |  |  |  |  |  | =D58*(1+F58) |  |  |
|  |  |  |  |  |  | =D59*(1+F59) |  |  |
|  |  |  |  |  |  | =D60*(1+F60) |  |  |
... truncated at 60 of 100 rows

## Sheet: Data Dictionary  (100 rows x 6 cols)
| Entity / Sheet | Field | Definition | Required | Source of Truth | Governance Note |
| Cost Ledger | Idempotency Key | Unique ingestion key preventing duplicate posting | Yes | Ingestion service | Never reused |
| Cost Ledger | Work Class | Economic purpose of the work | Yes | Task metadata / approved classification | Explicit, not inferred only from text |
| Cost Ledger | Attribution | Direct, allocated or unallocated treatment | Yes | Classification engine | Unallocated must remain visible |
| AI Runs | Price Version | Effective provider price book used | Yes | Price-book service | Required for reproducibility |
| Task Costing | Client Request | Approved special-request reference | Conditional | Client-request workflow | Mandatory for special requests |
| Allocation Rules | Version | Effective allocation policy version | Yes | Governance workflow | Closed periods retain original version |
| Budgets | Version | Approved budget or forecast version | Yes | Finance governance | Actual and budget remain separate |
... truncated at 60 of 100 rows