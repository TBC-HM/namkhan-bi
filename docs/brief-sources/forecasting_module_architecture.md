# Forecasting Module Architecture

## Version 1.0

# Purpose

The Forecasting Module is responsible for continuously estimating future commercial performance of the property and identifying opportunities or risks before they materialize.

It does not optimize occupancy.

It does not chase revenue.

It does not automatically change prices.

Its purpose is to provide the highest quality commercial intelligence for subsequent decision making.

Pricing, marketing and operations consume the forecasts produced by this module.

# Core Philosophy

The Forecasting Module exists to answer four questions.

What will probably happen?

Why will it happen?

How confident are we?

What could improve the outcome?

Forecasts are always probabilistic.

The module never presents certainty.

Every forecast contains confidence levels and assumptions.

# Commercial Principles

The module must always operate according to the Commercial DNA.

Primary objectives

Protect long-term brand value.

Protect ADR.

Protect pricing power.

Maximize long-term GOP.

Improve decision quality.

Preserve luxury positioning.

Secondary objectives

Improve occupancy.

Improve channel mix.

Improve forecasting accuracy.

Improve operational planning.

# Architecture

Owner Brain
                          │
                Forecasting Module
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
  Forecast Engine   Scenario Engine   Learning Engine
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
                  Orchestrator
                          │
      Revenue  Marketing  Operations Finance

The Forecasting Module is not a standalone AI.

It is a specialist operating mode of the Owner Brain.

# Major Components

## 1. Forecast Engine

Responsible for

Demand prediction

Occupancy prediction

ADR prediction

Revenue prediction

Pickup prediction

Cancellation prediction

Inventory utilization

Confidence scoring

Produces

Daily forecast

Weekly forecast

Monthly forecast

Annual forecast

## 2. Scenario Engine

Builds alternative futures.

Examples

Current forecast

Scenario A

No intervention

Scenario B

Marketing campaign

Scenario C

Package launch

Scenario D

Rate increase

Scenario E

Reduced inventory

Each scenario estimates

Revenue

ADR

Occupancy

GOP impact

Risk

Confidence

## 3. Learning Engine

Continuously measures

Forecast

↓

Actual Result

↓

Forecast Error

↓

Why

↓

Model Improvement

Nothing is forgotten.

Every forecast becomes training material.

## 4. Forecast Challenger

Purpose

Attempt to prove the forecast wrong.

Checks

stale data

missing data

unrealistic assumptions

unusual pace

competitor anomalies

historical inconsistencies

Produces

Confidence adjustments.

## 5. Insight Generator

Transforms forecasts into findings.

Example

Instead of

Occupancy forecast

38%

Produces

Villa demand expected to underperform by 24% during weeks 33–35.

Primary cause

Low conversion rather than insufficient demand.

Confidence

78%

## 6. Recommendation Generator

Does NOT execute.

Produces

Possible commercial responses.

Example

strengthen package

increase visibility

maintain rates

investigate conversion

review OTA exposure

# Forecast Horizons

## Live

Every hour

Purpose

Critical operational changes

## Short Term

0–30 Days

Updated daily.

Focus

Operational revenue.

## Medium Term

31–180 Days

Updated weekly.

Focus

Commercial strategy.

## Long Term

181–365 Days

Updated monthly.

Focus

Annual planning.

# Required Agents

## 1. Forecast Agent

Responsibilities

demand prediction

ADR prediction

occupancy prediction

room revenue prediction

Output

Forecast only.

No recommendations.

## 2. Challenger Agent

Responsibilities

Challenge

assumptions

confidence

data quality

unusual conclusions

Produces

Revised confidence.

## 3. Insight Agent

Converts numbers into business findings.

Example

Not

ADR down.

Instead

Chinese demand shifted later than historical booking window.

## 4. Scenario Agent

Creates

What if…

simulations.

Examples

What if

prices rise 8%

villas become packages

campaign launches

flights increase

OTA closes

## 5. Recommendation Agent

Produces

Commercial strategies.

Never executes.

## 6. Learning Agent

Compares

Prediction

vs

Reality.

Improves future forecasts.

## 7. Orchestrator

Most important component.

Responsibilities

Schedule

Coordinate

Merge

Prioritize

Store

Publish

Never forecasts.

Never recommends.

Coordinates.

# Forecast Loop

Scheduler

↓

Load Context

↓

Load Revenue Knowledge

↓

Load Commercial DNA

↓

Retrieve Historical Similar Cases

↓

Collect Live Data

↓

Forecast Agent

↓

Forecast Challenger

↓

Scenario Agent

↓

Insight Generator

↓

Recommendation Generator

↓

Store Forecast

↓

Publish Findings

↓

Measure Reality

↓

Learning Engine

↓

Knowledge Updated

# Trigger Types

## Scheduled

Daily

Weekly

Monthly

## Event Driven

Large cancellation

Group booking

Competitor change

Major event

Flight schedule

Website outage

Large pickup

Inventory change

Weather anomaly

## Manual

User request

“What is our forecast?”

# Required Markdown Documents

## Core

CommercialDNA.md

BrandPositioning.md

PropertyKnowledge.md

AnnualGoals.md

MarketCalendar.md

DecisionLedger.md

## Revenue

RevenuePhilosophy.md

PricingStrategy.md

PricingCorridors.md

RevenuePlaybook.md

RatePlanGuide.md

ForecastMethodology.md

ForecastKPIs.md

RevenueLearning.md

ChannelStrategy.md

PackageStrategy.md

CompSetStrategy.md

CancellationStrategy.md

MarketSegmentStrategy.md

## Marketing

CampaignCalendar.md

CampaignHistory.md

PromotionPlaybook.md

ContentStrategy.md

MarketDemandSignals.md

## Operations

OperationalCapacity.md

MaintenanceCalendar.md

RetreatCalendar.md

StaffConstraints.md

## Finance

Budget.md

ApprovalMatrix.md

InvestmentRules.md

# Live Data Required

Current OTB

Pickup

ADR

Revenue

Occupancy

LOS

Booking Window

Market Segment

Nationality

Rate Plan

Room Type

Channel

Cancellation Pace

Availability

Remaining Inventory

Website Traffic

Campaign Metrics

Flight Capacity

Holiday Calendar

Weather

Competitor Rates

Event Calendar

Guest Reviews

Search Volume

Historical Data

# Forecast Output

Every forecast must include

Executive Summary

Forecast

Confidence

Major Drivers

Risks

Opportunities

Recommended Investigations

Recommended Actions

Supporting Evidence

Scenario Comparison

Forecast Error History

# Confidence Model

Confidence is calculated from

Historical accuracy

Data freshness

Signal quality

Agreement between models

Data completeness

Current volatility

Confidence is always shown.

Never hide uncertainty.

# Learning Loop

Every completed period

Forecast

↓

Actual

↓

Variance

↓

Classification

↓

Reason

↓

Lesson

↓

Stored in RevenueLearning.md

↓

Available for future retrieval

The system continuously becomes better.

# Communication Between Modules

Revenue

publishes

Forecast Findings

↓

Marketing

adds

Demand Signals

↓

Operations

adds

Capacity Constraints

↓

Finance

adds

Budget Constraints

↓

Forecast updated

Departments never overwrite each other’s knowledge.

They contribute evidence.

# Success Metrics

Forecast Accuracy

ADR Accuracy

Occupancy Accuracy

Revenue Accuracy

Forecast Confidence Calibration

Recommendation Acceptance Rate

Recommendation Success Rate

Incremental GOP

Brand Protection Score

Forecast Stability

Learning Velocity

# Long-Term Vision

The Forecasting Module becomes the commercial prediction engine for the hotel.

It does not attempt to replace management.

It continuously answers

What is likely to happen?

Why?

How certain are we?

What options exist?

What happened after we acted?

How should we improve next time?

Over time the module develops institutional memory and becomes increasingly accurate, enabling commercial decisions based on evidence, historical learning and strategic principles rather than isolated daily observations.