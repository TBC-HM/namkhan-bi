# Central AI Chat Architecture

## Goal

Build **one central chat** inside the Vercel application that replaces
switching between ChatGPT, Claude and other tools.

The application should support both:

-   **Second Brain** -- connected to Supabase, hotel data, business
    rules and tools.
-   **General LLM Chat** -- direct conversations with different AI
    models.

------------------------------------------------------------------------

# Architecture

``` text
                    Vercel Application

                 ┌───────────────────────┐
                 │    Central Chat UI    │
                 └──────────┬────────────┘
                            │
                   Mode + Model Selector
                            │
          ┌─────────────────┴──────────────────┐
          │                                    │
   Second Brain Mode                   General Chat Mode
          │                                    │
     Supabase Memory                  Selected LLM
     Business Rules                   (OpenAI / Claude /
     Hotel Database                    Gemini / ...)
     Forecast Engine                          │
     Google Sheets                            │
     Reports                                  │
          └─────────────────┬──────────────────┘
                            │
                      Response to User
```

------------------------------------------------------------------------

# Two Modes

## 1. Second Brain

Uses:

-   Supabase memory
-   Business rules
-   Hotel data
-   Forecast engine
-   Reports
-   Google Sheets
-   Internal tools

Purpose:

-   Revenue Management
-   Operations
-   Forecasting
-   Documentation
-   Decision support

------------------------------------------------------------------------

## 2. General Chat

Uses only:

-   Selected AI model
-   Current conversation
-   Uploaded files

Purpose:

-   Brainstorming
-   Coding
-   Writing
-   Research
-   General questions

No automatic access to business data.

------------------------------------------------------------------------

# Suggested Interface

``` text
Mode:   [ Second Brain ▼ ]
Model:  [ Auto ▼ ]

----------------------------------

Conversation

----------------------------------

Type your message...
```

Modes

-   Second Brain
-   General Chat
-   Research
-   Data Analysis
-   Developer

Models

-   Auto
-   OpenAI
-   Claude
-   Gemini

------------------------------------------------------------------------

# Conversation Storage

Store every conversation in Supabase.

    Conversation
        ├── Messages
        ├── Summary
        ├── Decisions
        ├── Sources
        └── Tool Calls

The database is always the system of record.

------------------------------------------------------------------------

# Model Router

Instead of opening different websites:

    Question
          │
          ▼
    Model Router
          │
     ├── OpenAI
     ├── Claude
     ├── Gemini
     └── Future Models

The user selects:

-   Auto
-   OpenAI
-   Claude
-   Gemini

or the system chooses automatically.

------------------------------------------------------------------------

# Auto Model Routing

  Task                 Recommended Model
  -------------------- ----------------------------
  Quick questions      Fast model
  Complex reasoning    Reasoning model
  Coding               Coding model
  Long documents       Long-context model
  Business decisions   Second Brain primary model

------------------------------------------------------------------------

# Important Separation

## Second Brain

Uses internal data.

-   Supabase
-   Forecast engine
-   Calculations
-   Company knowledge
-   Business decisions

## General Chat

Uses only model knowledge.

No hotel database.

No internal calculations.

------------------------------------------------------------------------

# Suggested Database Fields

Conversation

-   mode
-   provider
-   model_id

Message

-   provider
-   model
-   token usage
-   latency
-   estimated cost

------------------------------------------------------------------------

# Recommended Development Order

## Phase 1

-   Central chat
-   Conversation storage

## Phase 2

-   Multiple LLM providers

## Phase 3

-   Second Brain integration

## Phase 4

-   Tool calling

## Phase 5

-   Forecast engine

## Phase 6

-   Google Sheets

## Phase 7

-   Documentation

------------------------------------------------------------------------

# Final Target

One application.

One chat.

One conversation history.

Multiple AI models.

A dedicated Second Brain connected to company knowledge and tools.

No more switching between ChatGPT, Claude and multiple browser tabs.
