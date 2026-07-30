# Spa Management Module
## Product, Operations, Booking, Analytics and AI Specification

**Document status:** Platform building specification  
**Module type:** Business operating module  
**Platform context:** Multi-tenant Supabase + Vercel AI platform  
**Primary users:** Spa reception, therapists, spa manager, hotel reception, finance, revenue management, marketing, management and guests  
**Design principle:** Easy enough for daily operations, deep enough for enterprise analytics  

---

# 1. Purpose

The Spa Management Module manages the complete commercial and operational lifecycle of a hotel, resort, day spa or wellness centre:

```text
Discover
→ Book
→ Confirm
→ Prepare
→ Check in
→ Deliver treatment
→ Check out
→ Post payment or room charge
→ Follow up
→ Analyse
→ Rebook
```

The module must combine:

- Online and internal booking
- Therapist scheduling
- Treatment-room scheduling
- Guest and customer profiles
- Confirmations and reminders
- Consultation forms and waivers
- Packages, memberships and vouchers
- Point-of-sale and hotel room charging
- Treatment delivery records
- Product and consumable inventory
- Commissions and payroll inputs
- Revenue, efficiency and profitability analytics
- Marketing, retention and rebooking
- AI-driven operational assistance

The module must not become an overcomplicated hospital system or generic ERP.

Its purpose is to let the spa team run the operation from one clear daily screen while allowing management to drill down into every appointment, therapist, room, treatment, guest, channel and financial result.

---

# 2. Industry Design Basis

Modern spa-management systems commonly combine:

- Appointment scheduling
- Online booking
- Staff calendars
- Treatment-room allocation
- Automated confirmations and reminders
- Guest profiles
- Memberships and treatment packages
- Payments and point-of-sale
- Retail sales
- Inventory
- Marketing automation
- Reporting

Resort and hotel spas additionally require:

- PMS integration
- Hotel guest recognition
- Room charging
- Multi-room and multi-resource scheduling
- Resort guest versus external guest logic
- Multi-property support
- Group and retreat scheduling
- Package posting and redemption

This module adopts those established operating patterns but removes unnecessary complexity and integrates them into the wider platform architecture.

---

# 3. Core Outcome

The module succeeds when every stakeholder can answer the following immediately:

```text
What is booked today?
Who is arriving next?
Which therapist and room are assigned?
Is the guest confirmed?
Are forms completed?
Has payment or guarantee been secured?
Is the treatment ready?
Was the appointment completed?
What revenue and margin did it generate?
Should the guest be rebooked?
Where are unused capacity and lost revenue?
```

---

# 4. Module Position in the Platform

```text
Owner Brain
    ↓
Spa Management Module
    ├── Booking and Calendar
    ├── Guest and CRM
    ├── Treatments and Resources
    ├── Therapist Operations
    ├── Packages and Memberships
    ├── POS and Payments
    ├── Inventory
    ├── Analytics and Efficiency
    ├── Marketing and Retention
    └── Spa Agents and Loops
```

Shared platform services:

```text
Client Onboarding Engine
Cost Engine
Revenue Engine
Content Generation Pipeline
Spreadsheet Studio
Notification Service
Document Service
Payment Service
Identity and Access
Audit Service
Agent Efficiency Engine
```

External integrations may include:

```text
PMS
POS
Payment gateway
Email
WhatsApp / SMS
Calendar
Accounting
Hotel booking engine
CRM
Gift-card platform
Website
Google Business Profile
```

---

# 5. Product Scope

The module should support:

- Hotel and resort spas
- Day spas
- Wellness centres
- Massage operations
- Beauty treatments
- Yoga and wellness consultations
- Sauna, ice bath and facility sessions
- Couples treatments
- Multi-treatment journeys
- Retreat schedules
- Spa day passes
- Memberships
- Treatment series
- Gift vouchers
- Retail products

Medical-spa functionality should remain a separate regulated extension.

The standard spa module should not include prescriptions, medical diagnosis or clinical records unless a separate compliance layer is implemented.

---

# 6. User Experience Principles

## 6.1 One Daily Operations Screen

The spa team should not navigate through many menus to run the day.

The main screen should display:

- Current time
- Today’s calendar
- Upcoming arrivals
- Appointment status
- Guest name
- Hotel room number where applicable
- Treatment
- Duration
- Therapist
- Treatment room
- Confirmation status
- Form status
- Payment or room-charge status
- Special notes
- Quick actions

Quick actions:

```text
Confirm
Check in
Start
Complete
No-show
Reschedule
Assign therapist
Assign room
Take payment
Charge room
Send message
Open guest profile
Rebook
```

## 6.2 Progressive Complexity

Daily users see only what they need.

Management and administrators receive deeper configuration and analytics.

```text
Reception
→ Simple calendar and guest flow

Therapist
→ Personal schedule and treatment information

Spa manager
→ Team, capacity, inventory and revenue

Management
→ Profitability, trends and performance

Administrator
→ Products, rules, integrations and permissions
```

## 6.3 Mobile First for Therapists

Therapists should be able to:

- View their schedule
- See preparation notes
- Check the guest in
- Start and complete treatment
- Record safe operational notes
- Recommend products
- Request room reset
- Mark consumables used
- Recommend rebooking

No financial or confidential information should be shown unless required by role.

---

# 7. Navigation Structure

Recommended menu:

```text
Spa
├── Today
├── Calendar
├── Bookings
├── Guests
├── Treatments
├── Therapists
├── Rooms & Resources
├── Packages
├── Memberships
├── Vouchers
├── Retail & Inventory
├── Sales
├── Analytics
├── Marketing
├── Tasks
└── Settings
```

For most operational users, default navigation should contain only:

```text
Today
Calendar
Guests
Sales
```

---

# 8. Booking Engine

## 8.1 Booking Sources

The module must accept bookings from:

- Spa reception
- Hotel reception
- Website
- Guest app
- Booking link
- Telephone
- Email
- WhatsApp
- Walk-in
- Concierge
- PMS
- Retreat or group booking
- External marketplace
- AI receptionist

Every booking must record its source.

---

## 8.2 Standard Booking Flow

```text
1. Select guest type
2. Identify or create guest
3. Select treatment or package
4. Select date
5. Show valid availability
6. Select time
7. Select therapist preference
8. Assign room and resources
9. Add enhancements
10. Apply package, membership or voucher
11. Collect guarantee or payment
12. Confirm policies
13. Create appointment
14. Send confirmation
15. Start reminder sequence
```

The internal booking flow should allow completion in under one minute for a standard returning guest.

---

## 8.3 Guest Types

```text
In-house hotel guest
Future hotel guest
External day guest
Member
Retreat participant
Group participant
Complimentary guest
Staff
VIP
Walk-in
```

Guest type can affect:

- Price
- Access rights
- Deposit requirements
- Cancellation policy
- Room-charge eligibility
- Facility access
- Membership benefits
- Communication flow

---

## 8.4 Availability Engine

Availability is not only an empty time slot.

A valid appointment requires all mandatory resources to be available:

```text
Treatment duration
+ Preparation buffer
+ Cleanup buffer
+ Qualified therapist
+ Compatible treatment room
+ Required equipment
+ Required facility
+ Operating hours
+ Guest constraints
```

The availability engine should calculate:

```text
Treatment availability
= Therapist availability
∩ Room availability
∩ Equipment availability
∩ Business rules
```

It must prevent:

- Therapist double booking
- Room double booking
- Impossible back-to-back treatments
- Booking outside working hours
- Booking treatments with unqualified therapists
- Booking equipment that is unavailable
- Booking a couples treatment without a compatible room or therapist pair

---

## 8.5 Smart Slot Ordering

Available slots should be ranked to improve utilisation.

The engine should prefer slots that:

- Fill otherwise unusable gaps
- Keep therapist schedules compact
- Match treatment-room suitability
- Avoid unnecessary overtime
- Protect high-demand times
- Respect guest preference
- Increase contribution margin
- Support hotel check-in and check-out timing

Example:

```text
A 60-minute massage should not automatically be placed
inside a 120-minute slot if a 60-minute gap exists elsewhere.
```

The user must still be able to override the recommendation with permission.

---

## 8.6 Appointment Statuses

```text
Draft
Pending guest confirmation
Confirmed
Guaranteed
Arrived
Checked in
In preparation
In treatment
Completed
Checked out
Cancelled
Late cancellation
No-show
Rescheduled
Waitlisted
Blocked
```

Status transitions must be controlled and auditable.

---

# 9. Confirmation and Communication Flow

## 9.1 Confirmation Sequence

Immediately after booking:

- Booking confirmation
- Date and local time
- Treatment name
- Duration
- Therapist preference, if confirmed
- Arrival time
- Location
- Preparation instructions
- Cancellation policy
- Deposit or payment status
- Manage-booking link
- Required form link
- Contact details

## 9.2 Reminder Sequence

Configurable example:

```text
At booking
→ Confirmation

48 hours before
→ Reminder and form request

24 hours before
→ Final confirmation request

3 hours before
→ Arrival reminder

After completion
→ Thank-you and aftercare

24 hours after
→ Feedback request

Defined rebooking interval
→ Rebooking invitation
```

The sequence should be reduced for short-notice bookings.

## 9.3 Confirmation Status

Track independently:

- Appointment created
- Confirmation sent
- Confirmation delivered
- Confirmation opened
- Guest confirmed
- Form completed
- Deposit received
- Reminder sent
- Guest responded

## 9.4 Two-Way Communication

Guests should be able to:

- Confirm
- Cancel within policy
- Request rescheduling
- Complete forms
- Ask a question
- Add a note
- Pay a deposit
- Add to calendar

Replies should be attached to the appointment and guest profile.

---

# 10. Treatment Catalogue

Each treatment requires:

- Treatment code
- Public name
- Internal name
- Category
- Description
- Duration
- Preparation time
- Cleanup time
- Base price
- Hotel-guest price
- Member price
- Tax and service-charge treatment
- Required therapist qualification
- Compatible rooms
- Required equipment
- Standard consumables
- Contraindication form
- Gender or therapist restrictions where legally permitted
- Add-ons
- Upgrade options
- Aftercare instructions
- Commission logic
- Active dates
- Available channels
- Cancellation policy
- Booking lead time

Treatment categories may include:

```text
Massage
Facial
Body treatment
Beauty
Couples treatment
Wellness consultation
Yoga
Sound healing
Sauna
Ice bath
Day pass
Ritual
Package
Retreat inclusion
```

---

# 11. Treatments, Packages and Journeys

## 11.1 Single Treatment

One service, one appointment.

## 11.2 Add-On

An enhancement attached to an appointment.

Examples:

- Additional 30 minutes
- Head massage
- Foot ritual
- Premium oil
- Sauna access

## 11.3 Treatment Series

A prepaid quantity of the same or related services.

Example:

```text
Six facials
Valid for three months
One redemption per visit
```

## 11.4 Package

Multiple items sold together.

Example:

```text
Massage
+ Sauna
+ Healthy lunch
+ Pool access
```

## 11.5 Spa Journey

A sequenced itinerary requiring multiple resources.

Example:

```text
Consultation
→ Sauna
→ Body scrub
→ Massage
→ Relaxation
```

The system must calculate the full journey, transitions and room changes.

## 11.6 Retreat Inclusion

A treatment included in a retreat programme.

The system should reserve capacity without charging the guest again while allocating internal revenue or package value for profitability analysis.

---

# 12. Memberships

Memberships may include:

- Recurring monthly payment
- Annual payment
- Included treatment credits
- Facility access
- Product discounts
- Service discounts
- Priority booking
- Guest passes
- Rollover rules
- Freeze rules
- Expiry rules
- Cancellation rules

Example:

```text
Wellness Membership

$150 per month
1 x 60-minute massage
10% off additional treatments
10% off retail
Sauna access
Unused treatment expires after 60 days
```

The system must track:

- Active members
- Billing status
- Benefits
- Credits issued
- Credits redeemed
- Unused liability
- Suspensions
- Churn
- Member revenue
- Member margin
- Member visit frequency
- Upgrade opportunity

---

# 13. Gift Vouchers and Credits

Support:

- Fixed-value vouchers
- Treatment-specific vouchers
- Package vouchers
- Promotional vouchers
- Complimentary vouchers
- Digital gift cards
- Physical gift cards

Required controls:

- Unique code
- Purchaser
- Recipient
- Value
- Remaining balance
- Validity
- Redemption history
- Partial redemption
- Fraud controls
- Revenue and liability treatment
- Expiry rules
- Transferability
- Refund status

---

# 14. Hotel and PMS Integration

For hotel spas, PMS integration is core functionality.

The spa module should receive:

- Reservation number
- Guest name
- Room number
- Arrival
- Departure
- Guest status
- Number of guests
- VIP status
- Package inclusions
- Preferences where permitted
- Room-charge authority

The spa should send:

- Appointment details where appropriate
- Spa charges
- Taxes
- Service charge
- Tips according to policy
- Voucher or package redemption
- Cancellation or no-show fee
- Posting reference

Room-charge checks:

```text
Guest is currently checked in
Room charge is permitted
Credit limit is valid
Reservation is not closed
Charge code is mapped
Posting succeeds
```

Failed postings must enter an exception queue and never disappear silently.

---

# 15. Check-In and Guest Preparation

At check-in, the system should show:

- Guest identity
- Hotel room where applicable
- Appointment
- Arrival status
- Form status
- Contraindications or operational alerts
- Therapist
- Room
- Payment or room-charge status
- Membership or package balance
- Special requests
- Language
- Previous preferences

The receptionist should be able to:

- Confirm identity
- Complete missing forms
- Assign locker
- Issue robe or amenities
- Record arrival time
- Alert therapist
- Adjust treatment with approval
- Collect payment or guarantee

---

# 16. Consultation Forms and Notes

The module should support:

- Digital consultation forms
- Consent
- Contraindication screening
- Pregnancy questions
- Allergies
- Pressure preference
- Areas to avoid
- Treatment objectives
- Signature
- Versioned terms
- Completion timestamp

Sensitive information must be protected by role-based access and retention rules.

Operational treatment notes should be:

- Minimal
- Relevant
- Structured
- Secure
- Non-diagnostic in the standard module
- Visible only to authorised roles

---

# 17. Therapist Management

## 17.1 Therapist Profile

- Identity
- Employment status
- Qualifications
- Treatment permissions
- Languages
- Availability
- Working hours
- Break rules
- Leave
- Preferred rooms
- Commission scheme
- Cost per hour
- Productivity target
- Guest rating
- Rebooking rate

## 17.2 Scheduling

Support:

- Regular shifts
- Split shifts
- Breaks
- Leave
- On-call status
- Overtime
- Temporary blocks
- Training
- Administrative time
- External contractors

## 17.3 Fair Assignment

Automatic assignment should consider:

- Qualification
- Availability
- Guest preference
- Gender preference where lawful
- Workload balance
- Commission neutrality
- Historical relationship
- Language
- Treatment-room location
- Overtime avoidance

The assignment logic must be transparent.

---

# 18. Rooms, Equipment and Facilities

Resource types:

```text
Treatment room
Couples room
Facial room
Massage room
Wet room
Consultation room
Sauna
Ice bath
Yoga area
Relaxation area
Equipment
Portable equipment
Locker
```

Each resource requires:

- Capacity
- Compatible treatments
- Opening hours
- Cleaning buffer
- Maintenance status
- Out-of-service period
- Location
- Setup requirements

Room utilisation and downtime must be measurable.

---

# 19. Operational Task Flow

Appointments can automatically create tasks.

Before treatment:

- Prepare room
- Prepare products
- Check linen
- Check equipment
- Review guest notes
- Confirm forms
- Prepare welcome drink

After treatment:

- Reset room
- Replace linen
- Record consumables
- Report maintenance issue
- Recommend retail
- Recommend rebooking
- Complete treatment status

Tasks should be short, role-specific and mobile-friendly.

---

# 20. Payments and Checkout

Payment methods:

- Cash
- Card
- Digital wallet
- Hotel room charge
- Membership credit
- Package redemption
- Gift voucher
- Prepaid credit
- Complimentary
- Split payment

Checkout should support:

- Service items
- Add-ons
- Retail products
- Taxes
- Service charge
- Tips
- Discounts
- Membership benefits
- Package redemption
- Voucher redemption
- Refunds
- Partial refunds

The system must distinguish:

```text
Gross sales
Net sales
Tax
Service charge
Tips
Discount
Refund
Deferred voucher liability
Membership liability
Recognised revenue
Cash collected
Room charges posted
```

These values should connect to the Revenue and Cost Engines.

---

# 21. Cancellations, Deposits and No-Shows

Policies can differ by:

- Guest type
- Treatment
- Package
- Channel
- Membership
- Advance booking window
- High-demand date

The system should support:

- Card guarantee
- Fixed deposit
- Percentage deposit
- Full prepayment
- Room-charge guarantee
- Free cancellation deadline
- Late-cancellation fee
- No-show fee
- Manual waiver with reason and permission

Track:

- Cancellation reason
- Cancellation timing
- Recoverable slot
- Slot resold
- Fee charged
- Fee waived
- Waiver owner
- Lost revenue

---

# 22. Waitlist and Capacity Recovery

The waitlist should capture:

- Guest
- Treatment
- Date range
- Time range
- Therapist preference
- Contact channel
- Response deadline
- Priority

When capacity opens:

```text
Match suitable waitlist guests
→ Rank candidates
→ Send offer
→ Hold slot temporarily
→ Confirm first accepted guest
→ Release remaining offers
```

This is a direct revenue-protection function.

---

# 23. Retail and Inventory

The module should manage:

- Retail products
- Professional-use products
- Consumables
- Linen-related stock if required
- Purchase orders
- Suppliers
- Receiving
- Transfers
- Stock counts
- Waste
- Expiry
- Reorder points
- Treatment recipes

Treatment recipe example:

```text
60-minute massage
→ 20 ml massage oil
→ 1 disposable item
→ Linen set
```

Completing the treatment can post standard consumption automatically.

Manual variance remains visible.

---

# 24. Spa Analytics

## 24.1 Executive KPIs

- Total spa revenue
- Treatment revenue
- Retail revenue
- Membership revenue
- External guest revenue
- In-house guest revenue
- Revenue per available treatment hour
- Revenue per occupied treatment hour
- Gross margin
- Contribution margin
- Payroll percentage
- Product cost percentage
- Spa capture rate
- Average spend per guest
- Rebooking rate
- No-show rate
- Cancellation rate

## 24.2 Booking KPIs

- Appointments booked
- Appointments completed
- Booking conversion
- Online booking share
- Booking lead time
- Booking source
- Confirmation rate
- Deposit coverage
- Waitlist conversion
- Slot recovery
- Cancellation timing
- No-show value

## 24.3 Capacity KPIs

- Therapist utilisation
- Treatment-room utilisation
- Bookable hours
- Occupied hours
- Productive hours
- Unused capacity
- Schedule gaps
- Overtime
- Downtime
- Peak-time utilisation
- Day-of-week utilisation
- Hour-of-day utilisation

## 24.4 Therapist KPIs

- Revenue
- Treatments completed
- Occupied hours
- Utilisation
- Revenue per treatment hour
- Average ticket
- Retail attachment
- Rebooking rate
- Guest rating
- No-show exposure
- Commission
- Labour cost
- Contribution

## 24.5 Treatment KPIs

- Treatment volume
- Treatment revenue
- Average price
- Discount rate
- Duration
- Room usage
- Therapist cost
- Consumable cost
- Contribution margin
- Repeat rate
- Add-on attachment
- Cancellation rate
- Guest rating

## 24.6 Guest KPIs

- New versus returning
- Visit frequency
- Lifetime value
- Average spend
- Preferred treatment
- Preferred therapist
- Membership status
- Package balance
- Rebooking
- Churn risk
- Source market
- Hotel guest capture

## 24.7 Hotel Spa KPIs

```text
Spa Capture Rate
= Hotel guests using spa / eligible hotel guests
```

Also track:

- Spa revenue per occupied room
- Spa revenue per hotel guest
- Pre-arrival spa booking rate
- In-stay booking rate
- Room-type capture
- Package inclusion redemption
- Day-spa versus hotel-spa mix
- Spa contribution to total guest spend

---

# 25. Efficiency Metrics

The module should measure not only sales but operational efficiency.

## Revenue per Available Treatment Hour

```text
Treatment revenue
÷ Total bookable therapist hours
```

## Revenue per Occupied Treatment Hour

```text
Treatment revenue
÷ Completed treatment hours
```

## Therapist Utilisation

```text
Completed treatment hours
÷ Available therapist hours
```

## Room Utilisation

```text
Occupied room hours
÷ Available room hours
```

## Schedule Fragmentation

Measures unusable gaps created between appointments.

## Treatment Contribution

```text
Net treatment revenue
- Therapist direct cost
- Consumables
- Payment cost
- Direct commission
```

## Lost Capacity Value

```text
Available unsold hours
× Expected revenue per hour
```

## No-Show Loss

```text
Unrecovered no-show value
- Fees collected
- Replacement booking revenue
```

---

# 26. Forecasting and Demand Management

The module should forecast:

- Appointments
- Treatment hours
- Therapist demand
- Room demand
- Revenue
- Retail sales
- Consumables
- Membership redemptions
- Hotel guest capture

Inputs:

- Historical bookings
- Hotel occupancy
- Arrivals and departures
- Day of week
- Season
- Holidays
- Retreats
- Groups
- Events
- Weather where relevant
- Promotions
- Therapist availability
- Booking pace

Outputs:

- Expected demand by day and hour
- Staffing recommendation
- Capacity shortage
- Low-demand periods
- Promotion opportunity
- Inventory requirement
- Revenue forecast

---

# 27. Yield and Pricing

Optional advanced functionality:

- Peak and off-peak pricing
- Guest-type pricing
- Member pricing
- Last-minute offers
- Advance-purchase offers
- Bundled pricing
- Length or journey pricing
- Therapist-tier pricing
- High-demand date restrictions

Pricing recommendations should consider:

- Remaining capacity
- Booking lead time
- Hotel occupancy
- Historical conversion
- Treatment margin
- Therapist scarcity
- Room scarcity
- Member obligations
- Brand positioning

The engine should recommend prices, not autonomously change public pricing without authorised rules.

---

# 28. Marketing and Retention

Segments:

- New guests
- Returning guests
- Hotel guests without spa booking
- Guests with abandoned booking
- Lapsed guests
- Members
- High-value guests
- Package holders
- Voucher holders
- Birthday or anniversary guests
- Treatment-interest segments

Automations:

```text
Booking abandonment
→ Send recovery message

Completed massage
→ Recommend rebooking at preferred interval

Unused membership credit
→ Reminder before expiry

Hotel arrival in seven days
→ Pre-arrival spa offer

No visit in 90 days
→ Win-back campaign

Positive feedback
→ Review request
```

Every campaign should be attributable to bookings and revenue.

---

# 29. AI Agents

## 29.1 AI Spa Receptionist

Can:

- Answer common questions
- Explain treatments
- Find availability
- Create bookings
- Reschedule within rules
- Send forms
- Confirm policy
- Escalate unusual cases

Cannot:

- Make medical claims
- Override contraindications
- Waive fees without authority
- Grant unauthorised discounts

## 29.2 Daily Spa Operations Agent

Produces:

- Today’s occupancy
- VIP arrivals
- Unconfirmed appointments
- Missing forms
- Staffing gaps
- Room conflicts
- Capacity opportunities
- Expected revenue
- Required actions

## 29.3 Capacity Optimisation Agent

Finds:

- Schedule gaps
- Misallocated rooms
- Underused therapists
- Waitlist opportunities
- Sellable last-minute slots
- Overtime risk

## 29.4 Spa Revenue Agent

Reviews:

- Pace
- Average spend
- Discounts
- No-shows
- Package sales
- Membership sales
- Treatment mix
- Margin
- Hotel capture

## 29.5 Guest Retention Agent

Identifies:

- Rebooking opportunities
- Churn risk
- Lapsed members
- Unused credits
- Suitable next treatment
- Retail recommendations

## 29.6 Inventory Agent

Predicts:

- Reorder needs
- Treatment consumption
- Expiry risk
- Variance
- Unusual waste
- Stockout risk

## 29.7 Quality Agent

Reviews:

- Guest feedback
- Therapist ratings
- Complaint themes
- Treatment issues
- Repeated operational failures
- Training needs

---

# 30. Operational Loops

## 30.1 Booking Confirmation Loop

```text
Booking created
→ Validate contact details
→ Send confirmation
→ Track delivery
→ Request form
→ Request deposit if required
→ Remind guest
→ Escalate unconfirmed high-value booking
```

## 30.2 Daily Readiness Loop

```text
Review next-day appointments
→ Validate therapist
→ Validate room
→ Validate forms
→ Validate stock
→ Validate payment guarantee
→ Create preparation tasks
```

## 30.3 Same-Day Capacity Loop

```text
Find unsold capacity
→ Check waitlist
→ Check in-house hotel guests
→ Identify suitable segment
→ Recommend controlled offer
→ Measure conversion
```

## 30.4 No-Show Prevention Loop

```text
Score appointment risk
→ Confirm contact
→ Request deposit
→ Increase reminder intensity
→ Offer easy rescheduling
→ Protect high-value capacity
```

## 30.5 Post-Treatment Loop

```text
Treatment completed
→ Post payment
→ Record consumption
→ Calculate commission
→ Send aftercare
→ Request feedback
→ Recommend rebooking
```

## 30.6 Membership Retention Loop

```text
Review usage
→ Detect unused benefits
→ Detect payment failure
→ Detect declining visits
→ Trigger reminder or intervention
```

## 30.7 Hotel Capture Loop

```text
Read upcoming arrivals
→ Identify guests without spa booking
→ Match suitable offer
→ Send pre-arrival invitation
→ Track booking and revenue
```

---

# 31. Alerts

Critical:

- Double booking
- Failed room charge
- Missing qualified therapist
- Appointment without room
- Payment or deposit failure
- Integration failure
- High-value cancellation
- Inventory stockout
- Guest safety alert
- Privacy or access issue

Operational:

- Missing form
- Unconfirmed appointment
- Schedule gap
- Therapist overtime
- Room out of service
- Membership payment failure
- Voucher nearing expiry
- Low rebooking rate

Alerts must be:

- Actionable
- Assigned
- Prioritised
- Deduplicated
- Time-limited
- Auditable

---

# 32. Roles and Permissions

## Spa Reception

Can:

- Create and edit bookings
- Check guests in and out
- Take payments
- Use package and membership benefits
- Send communications

## Therapist

Can:

- View assigned appointments
- View necessary guest information
- Start and complete treatment
- Add permitted operational notes
- Record products and recommendations

## Spa Manager

Can:

- Manage schedules
- Manage rooms
- Approve overrides
- Configure treatments
- Review performance
- Manage inventory
- Review commissions

## Hotel Reception

Can:

- View permitted availability
- Create hotel-guest bookings
- View booking confirmation
- Charge permitted items to room

## Finance

Can:

- Review sales
- Reconcile payment
- Review liabilities
- Review taxes
- Export accounting data

## Marketing

Can:

- Use approved segments
- Create campaigns
- Track attribution
- View non-sensitive guest preferences

## Management

Can:

- View analytics
- Review profitability
- Review performance
- Approve commercial policy

---

# 33. Multi-Tenant Requirements

Every record must include a tenant identifier.

Optional hierarchy:

```text
Platform
→ Customer organisation
→ Property
→ Spa location
→ Department
```

The system must support:

- Separate configuration by tenant
- Separate treatment catalogues
- Separate prices
- Separate tax rules
- Separate currencies
- Separate communications
- Separate staff
- Separate resources
- Cross-property reporting where authorised
- Central group management
- Tenant-safe AI context
- Row-level security
- Audit logs

---

# 34. Core Data Model

Recommended entities:

```text
spa_locations
spa_operating_hours
spa_guests
spa_guest_preferences
spa_guest_forms
spa_treatments
spa_treatment_versions
spa_treatment_addons
spa_treatment_recipes
spa_packages
spa_package_items
spa_memberships
spa_member_accounts
spa_member_benefits
spa_vouchers
spa_appointments
spa_appointment_items
spa_appointment_status_history
spa_waitlist
spa_therapists
spa_therapist_qualifications
spa_therapist_schedules
spa_rooms
spa_resources
spa_resource_blocks
spa_booking_sources
spa_confirmations
spa_messages
spa_payments
spa_room_charge_postings
spa_refunds
spa_retail_products
spa_inventory_movements
spa_commissions
spa_feedback
spa_tasks
spa_alerts
spa_forecasts
spa_daily_snapshots
spa_audit_events
```

---

# 35. Appointment Record

Minimum appointment fields:

```text
appointment_id
tenant_id
spa_location_id
guest_id
hotel_reservation_id
hotel_room_number
booking_source
appointment_status
start_at
end_at
arrival_at
check_in_at
treatment_start_at
treatment_end_at
checkout_at
therapist_id
room_id
treatment_id
package_id
membership_id
voucher_id
price
discount
tax
service_charge
tip
net_revenue
payment_status
room_charge_status
confirmation_status
form_status
cancellation_policy_id
notes
created_by
created_at
updated_at
```

---

# 36. Integrations

## Required or High Priority

- PMS
- POS or payment system
- Email
- SMS or WhatsApp
- Website booking widget
- Accounting export
- Platform Cost Engine
- Platform Revenue Engine

## Useful

- Google Calendar
- CRM
- Hotel guest app
- Gift-card provider
- Marketing automation
- Review platforms
- Access-control systems
- Inventory suppliers

Integration failures must enter visible queues with retry and ownership.

---

# 37. Required Reports

## Daily

- Daily appointment list
- Therapist schedule
- Room schedule
- Arrival and confirmation report
- Missing forms
- Daily revenue
- Payment reconciliation
- No-shows and cancellations
- Stock exceptions

## Weekly

- Revenue by treatment
- Revenue by therapist
- Utilisation
- Room efficiency
- Booking source
- Retail attachment
- Rebooking
- Membership activity
- Hotel capture
- Guest feedback

## Monthly

- Profit and contribution
- Treatment profitability
- Therapist productivity
- Payroll and commission
- Membership economics
- Voucher liability
- Package liability
- Inventory variance
- Marketing attribution
- Forecast versus actual
- Year-on-year performance

---

# 38. MVP

## Phase 1 — Operational Core

- Treatment catalogue
- Therapist profiles
- Room and resource setup
- Calendar
- Internal booking
- Appointment statuses
- Guest profiles
- Confirmations
- Check-in and checkout
- Payments and room charge
- Basic daily reporting
- Permissions
- Audit log

## Phase 2 — Commercial Layer

- Online booking
- Deposits
- Packages
- Memberships
- Vouchers
- Retail
- Inventory
- Commissions
- Cancellation and no-show controls
- PMS integration
- Revenue and Cost Engine integration

## Phase 3 — Intelligence

- Capacity optimisation
- Demand forecast
- Hotel capture
- Rebooking automation
- Membership retention
- Treatment profitability
- AI receptionist
- Daily operations agent

## Phase 4 — Advanced Enterprise

- Multi-property control
- Dynamic pricing
- Partner booking
- Retreat journeys
- Group scheduling
- White-label booking
- Benchmark analytics
- Predictive maintenance
- Advanced workforce planning

---

# 39. What Not to Build Initially

Avoid unnecessary first-version complexity:

- Full medical records
- Insurance billing
- Complex clinical workflows
- Custom accounting ledger
- Separate CRM duplicating the platform CRM
- Fully autonomous pricing
- Fully autonomous discounting
- Excessive therapist note-taking
- Complicated navigation
- Reports without decisions attached

The module should begin with operational reliability and ease of use.

---

# 40. Acceptance Criteria

The standard module is ready when:

- A treatment can be configured
- A therapist can be qualified and scheduled
- A room can be configured
- A guest can book online or internally
- The system prevents resource conflicts
- Confirmation and reminders are delivered
- Forms and deposits are tracked
- The guest can check in
- The therapist can complete treatment
- Payment or room charge can be posted
- Package, membership or voucher benefits can be redeemed
- Revenue and cost can be attributed
- Management can see utilisation, revenue and margin
- Every important action is auditable

---

# 41. Final Design Principle

The module should feel simple at the point of use because complexity is managed by the engine.

```text
One calendar
One guest record
One appointment lifecycle
One resource engine
One financial trail
One analytical model
```

The operational screen should tell the spa team what must happen next.

The analytical layer should tell management:

```text
Where capacity is lost
Where revenue is lost
Which treatments create value
Which therapists need support
Which guests should be rebooked
Which members are at risk
What demand is coming
What action should be taken
```

That is the difference between a booking calendar and a complete Spa Management Module.
