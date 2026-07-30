# Development Review Brief – Spreadsheet Studio Module

## Objective

Review the current design and implementation of the Spreadsheet Studio module against the following architectural concepts and determine whether the existing implementation should be adapted.

This is not an instruction to overwrite the current design. The existing architecture always has priority unless there is a demonstrably better solution.

Use architectural reasoning rather than literal compliance.

# General Principle

The Spreadsheet Studio is not another business intelligence module.

It is the platform’s universal spreadsheet generation, reporting and analytical workspace.

Its purpose is to transform natural-language requests into structured Google Sheets using live platform data.

It is a presentation, modelling and collaboration layer—not the owner of business logic.

# Architectural Position

The module sits behind the Owner Brain and is invoked by the Architect only when required.

Typical flow:

User

↓

Owner Brain

↓

Architect

↓

Spreadsheet Studio

↓

Relevant business modules

↓

Google Sheets

↓

Return Sheet URL

The Spreadsheet Studio should never permanently live inside the Owner Brain context.

It should only be loaded dynamically when spreadsheet-related work is requested.

# Dynamic Context Loading

The platform architecture is based on selective context loading.

Example:

Request: “Show me the 12-month forecast.”

Architect loads:

Spreadsheet Studio

Forecasting Module

Financial Planning Module

Nothing else.

After completion, the module leaves active context.

The Registry knows every module.

The Context Loader decides which modules are required.

The Retriever loads only relevant documentation and data.

The Architect orchestrates.

This principle must remain intact.

# Core Responsibility

Spreadsheet Studio should:

understand spreadsheet requests

interpret business intent

determine required data

obtain authoritative data from the correct modules

perform approved calculations

create or update Google Sheets

validate workbook integrity

return a Google Sheets link

# Explicit Non-Responsibilities

Spreadsheet Studio must not:

become a second Forecasting engine

duplicate Financial Planning logic

replace Revenue Management

own business calculations already implemented elsewhere

create competing business logic

become another dashboard

The authoritative source always remains the originating module.

Spreadsheet Studio consumes those outputs.

# Data Flow Philosophy

Preferred workflow:

User Request

↓

Spreadsheet Studio

↓

Determine required information

↓

Request data from specialist modules

↓

Receive structured results

↓

Build workbook

↓

Validate workbook

↓

Register workbook

↓

Return Google Sheets URL

# Authoritative Modules

Examples:

Forecasts → Forecasting Module

Budgets → Financial Planning

Revenue KPIs → Revenue Module

Marketing → Marketing Module

Operations → Operations Module

Spreadsheet Studio should request information instead of recreating it.

# Request Interpretation

Natural-language requests should be interpreted intelligently.

Example:

“Show me the forecast.”

Should automatically infer reasonable defaults such as:

active property

default forecast horizon

monthly granularity

occupancy

ADR

RevPAR

Room Revenue

Budget comparison

Prior year comparison

Avoid unnecessary clarification unless ambiguity materially affects the result.

# Workbook Types

The design should support reusable workbook families.

Examples include:

Revenue

Forecast

Financial Planning

Marketing

CRM

Operations

Payroll

Purchasing

Cash Flow

Custom Analysis

Templates should remain extensible.

# Workbook Templates

Each workbook should include:

Executive Summary

Data

Analysis

Assumptions

Source Log

Version

Data Timestamp

Templates should be version-controlled.

# Workbook Registry

Every generated workbook should be registered.

Suggested metadata includes:

Workbook ID

Google Sheet ID

URL

Workbook Type

Owner

Source Modules

Creation Date

Last Refresh

Data Timestamp

Template Version

Status

Access Classification

The system should always know:

who created it

why it exists

where it came from

whether it is current

# Calculation Philosophy

Two possible approaches exist.

Option A

Platform performs calculations.

Google Sheets receives calculated values.

Option B

Platform writes spreadsheet formulas.

Google Sheets performs calculations.

Preferred architecture:

Core business calculations remain inside platform modules.

Interactive scenario calculations may exist inside Google Sheets where appropriate.

Please evaluate whether this hybrid approach best fits the current architecture.

# Validation Layer

Every workbook should pass validation before delivery.

Examples:

totals reconcile

occupancy limits respected

revenue matches ADR × room nights

formulas intact

no broken references

currency consistency

date consistency

freshness checks

permission checks

Workbook generation should fail safely if validation fails.

# Refresh Capability

Support both:

Interactive generation

and

Scheduled refresh.

Example:

Daily refresh

↓

retrieve latest data

↓

update workbook

↓

validate

↓

store refresh metadata

↓

notify only when appropriate

# User Experience

Typical interaction:

“Show me the 12-month forecast.”

Response:

Workbook created.

Open Google Sheet.

Include:

data timestamp

workbook version

major comparisons

short executive highlights

The spreadsheet contains the detailed analysis.

# Workbook Standards

Please verify that the implementation includes standards for:

consistent layouts

frozen headers

filters

standardized date formats

protected formulas

conditional formatting

documented assumptions

source references

version metadata

clean formatting

# Documentation

If accepted, the module should contain documentation similar to:

MODULE.md

REQUEST_INTERPRETATION.md

WORKBOOK_STANDARDS.md

TEMPLATE_REGISTRY.md

CALCULATION_POLICY.md

GOOGLE_SHEETS_WRITER.md

VALIDATION_RULES.md

ACCESS_CONTROL.md

REFRESH_LOOP.md

OUTPUT_SCHEMA.md

CHANGELOG.md

Adapt naming if the current documentation standard differs.

# Integration with Platform Architecture

Please verify compatibility with:

Owner Brain

Architect

Module Registry

Context Loader

Retrieval Framework

Permission Framework

Knowledge Management

Existing module interfaces

The Spreadsheet Studio should strengthen—not bypass—the platform architecture.

# Important Review Instructions

Do not overwrite the existing implementation simply because this document proposes ideas.

Instead:

Compare these concepts against the current architecture.

Identify where the current implementation is already stronger.

Identify genuine improvements worth adopting.

Reject suggestions that conflict with established architectural principles unless there is a compelling reason.

Preserve consistency across the entire platform.

Update implementation specifications only where the resulting architecture is objectively better.

Reason as a senior platform architect, not as a document follower.

The goal is architectural coherence, maintainability, and long-term scalability—not compliance for its own sake.