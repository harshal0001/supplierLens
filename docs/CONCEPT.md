# SupplierLens

## AI-Powered Supplier Intelligence and Risk Management Platform

**Tagline:** Know your suppliers before their risks become your business
problems.

**Category:** Enterprise AI / B2B SaaS\
**Initial market:** German and European small and medium-sized
manufacturing businesses\
**Primary users:** Procurement managers, operations managers, finance
leaders and managing directors\
**Core capabilities:** Supplier intelligence, document AI, explainable
risk scoring, external risk monitoring, RAG and voice AI.

------------------------------------------------------------------------

# 1. Executive Summary

SupplierLens is an AI-powered supplier intelligence platform that helps
businesses identify, understand and mitigate supplier risks before they
become costly business disruptions.

It consolidates supplier information from documents, spreadsheets and
relevant public sources, analyses potential financial, operational,
delivery, compliance and external risks, and presents explainable
assessments with supporting evidence and recommended actions.

Procurement managers can also interact with SupplierLens through a
voice-enabled AI assistant powered by ElevenLabs. They can ask questions
such as:

> Which supplier has the highest risk, why is it risky, and what should
> we do next?

SupplierLens is designed to make supplier intelligence more accessible
to SMEs that may not have the budget, expertise or resources for complex
enterprise risk-management platforms.

## Product vision

Make supplier risk intelligence understandable, actionable and
accessible to every growing business.

## Core value proposition

SupplierLens turns disconnected supplier information into a centralized,
evidence-backed view of supplier reliability and risk.

------------------------------------------------------------------------

# 2. Problem & Customer

## 2.1 The problem

Businesses depend on external suppliers for raw materials, components,
logistics, manufacturing and essential services. However, many small and
medium-sized businesses lack a centralized and continuously updated view
of supplier reliability.

Supplier information is often scattered across:

-   Excel spreadsheets
-   PDF contracts and quotations
-   Financial reports
-   Email communications
-   Certification documents
-   ERP and procurement systems
-   External websites and news sources

Procurement teams frequently collect and review this information
manually. Supplier assessments may happen periodically, even though
supplier conditions can change at any time.

Potential warning signs include:

-   Financial difficulties or signs of financial instability
-   Deteriorating delivery performance
-   Operational disruptions
-   Expired or missing certifications
-   Regulatory or compliance concerns
-   Negative company news
-   Geopolitical or supply-chain exposure
-   Excessive dependency on a single supplier

These issues can lead to production delays, higher procurement costs,
contractual penalties and lost revenue.

**Core problem:** Businesses lack a simple, centralized and
evidence-backed way to understand changing supplier risks and decide
what action to take.

## 2.2 Target customers

The initial target market is German manufacturing SMEs, followed by the
broader European market.

  -----------------------------------------------------------------------
  Customer segment                    Typical pain point
  ----------------------------------- -----------------------------------
  Manufacturing SMEs                  Supplier disruptions can interrupt
                                      production

  Automotive suppliers                Dependency on critical component
                                      suppliers

  Procurement departments             Manual supplier evaluation and
                                      documentation

  Logistics companies                 Delivery and operational risks

  Electronics manufacturers           Component availability and supplier
                                      dependency

  Procurement consultants             Evaluating multiple suppliers for
                                      clients
  -----------------------------------------------------------------------

## 2.3 Ideal customer profile

Initial ICP hypothesis:

-   German manufacturing or industrial business
-   Approximately 20--500 employees
-   Approximately 20--200 active suppliers
-   Small procurement team
-   Supplier information spread across spreadsheets, emails and
    documents
-   No dedicated enterprise supplier-risk intelligence platform

These characteristics are hypotheses to validate through customer
discovery.

## 2.4 Buyer personas

1.  **Procurement Manager:** Wants to identify high-risk suppliers
    before disruptions occur.
2.  **Operations Manager:** Wants to prevent production delays and
    maintain continuity.
3.  **CFO / Finance Manager:** Wants visibility into supplier financial
    exposure.
4.  **Managing Director:** Wants to understand critical business
    dependencies.

## 2.5 Customer discovery questions

Interview procurement professionals and ask:

-   How do you currently evaluate suppliers?
-   Where is supplier information stored?
-   How often do you reassess supplier risk?
-   What types of supplier disruption have caused problems?
-   How much time does supplier research take?
-   Which external sources do you trust?
-   What happens when a supplier's risk profile changes?
-   Which parts of the process would you automate?
-   What would make a supplier-risk tool valuable enough to pay for?
-   Who would approve and own the purchase?

Do not claim validated demand until these interviews have taken place.

------------------------------------------------------------------------

# 3. Product Overview

SupplierLens is organized into six core modules.

## 3.1 Supplier Intelligence Dashboard

A centralized workspace for supplier profiles and portfolio visibility.

Features:

-   Supplier directory
-   Supplier profile pages
-   Overall risk score and classification
-   Risk category breakdown
-   Historical assessments
-   Document management
-   External signals
-   Evidence and source links
-   Recommended actions

## 3.2 AI Document Intelligence

Users upload supplier documents, and the system extracts relevant
information.

Supported document types may include:

-   PDF contracts
-   Supplier quotations
-   Financial reports
-   Certifications
-   Company profiles
-   Excel supplier lists
-   Word documents

Features:

-   Text and table extraction
-   Structured information extraction
-   Key date and expiry extraction
-   Identification of missing documents
-   Identification of potentially concerning clauses or information
-   Document classification
-   Semantic indexing for retrieval

The system should distinguish information explicitly stated in a
document from AI-generated interpretation.

## 3.3 Supplier Risk Scoring Engine

The risk engine evaluates available evidence across several categories
and calculates an explainable score.

Proposed initial weights:

  Risk category                       Weight
  ------------------------------- ----------
  Financial risk                         25%
  Operational risk                       25%
  Delivery and performance risk          20%
  Compliance risk                        15%
  External / geopolitical risk           15%
  **Total**                         **100%**

Each category receives a score between 0 and 100, where a higher score
indicates greater risk.

Formula:

`Overall Risk = Σ (Category Weight × Category Risk Score)`

If weights are represented as percentages, divide the weighted sum by
100.

Proposed classifications:

  Score     Classification
  --------- ----------------
  0--30     Low
  31--60    Medium
  61--100   High

These thresholds and weights are starting hypotheses. They should be
calibrated using customer feedback, historical evidence and observed
outcomes.

### Risk scoring requirements

-   Every score must be explainable.
-   Each indicator should have supporting evidence where available.
-   Track source URL, source date and retrieval timestamp.
-   Track data freshness and confidence separately from risk.
-   Missing data must not automatically be interpreted as low risk.
-   Avoid presenting estimates as verified facts.
-   Allow users to inspect the factors contributing to a score.
-   Preserve historical assessments so changes can be understood.

## 3.4 External Risk Monitoring

Use external search and data sources to find relevant public information
about suppliers.

Potential signals:

-   Relevant company news
-   Public financial warning signals
-   Regulatory developments
-   Operational disruption signals
-   Litigation or compliance-related public information, where
    appropriate
-   Geopolitical exposure
-   Facility closures or major operational changes

Use Exa API for relevant web research in the MVP.

Store:

-   Supplier association
-   Source title
-   Source URL
-   Publication date, when available
-   Retrieval timestamp
-   Extracted claim
-   Evidence excerpt
-   Relevance assessment
-   Verification status

Search results and snippets are leads, not proof. Important claims
should be supported by the underlying source and presented with
appropriate uncertainty.

## 3.5 Voice AI Procurement Analyst

Integrate ElevenLabs to provide a natural voice interface.

Example questions:

-   Which supplier has the highest risk?
-   Why is this supplier considered high risk?
-   Compare Supplier A and Supplier B.
-   What evidence supports this assessment?
-   Have any relevant warning signals appeared recently?
-   What should our procurement team do next?
-   Which supplier documents are missing?

### Recommended voice architecture

1.  User speaks into the frontend microphone.
2.  Speech is transcribed using an appropriate ElevenLabs speech
    capability.
3.  The frontend sends the query to the FastAPI backend.
4.  The backend authenticates the user and identifies the organization.
5.  LangGraph orchestrates supplier lookup, RAG retrieval and tool
    calls.
6.  The LLM generates an answer grounded in retrieved supplier data.
7.  The backend returns the answer and its evidence references.
8.  ElevenLabs generates spoken output.
9.  The frontend plays the response and displays the text and sources.

For a more conversational experience, evaluate ElevenLabs Agents and its
custom tool integration. Keep supplier data access, authorization and
business logic in the backend.

Potential backend tools for the voice agent:

-   `get_supplier_profile(supplier_id)`
-   `get_supplier_risk_score(supplier_id)`
-   `compare_suppliers(supplier_a, supplier_b)`
-   `search_supplier_news(supplier_id)`
-   `get_risk_evidence(supplier_id)`
-   `get_missing_documents(supplier_id)`
-   `create_risk_alert(supplier_id)`

All tools must enforce authentication, organization-level access and
permissions.

## 3.6 AI Recommendations and Alerts

Based on available evidence, SupplierLens can recommend follow-up
actions.

Examples:

-   Request updated financial documentation.
-   Contact the supplier for clarification.
-   Review outstanding purchase orders.
-   Verify an expiring certification.
-   Identify alternative suppliers for critical components.
-   Schedule a supplier reassessment.
-   Escalate an issue to the procurement manager.

Recommendations should explain which evidence triggered them.
Consequential actions should require user confirmation.

------------------------------------------------------------------------

# 4. Example End-to-End User Journey

Imagine a German automotive components manufacturer using SupplierLens.

### Step 1: Add suppliers

The procurement manager imports an Excel file containing 50 suppliers.

### Step 2: Upload documents

They upload available contracts, certifications, financial reports and
supplier quotations.

### Step 3: AI analysis

SupplierLens extracts relevant information, indexes the documents and
searches for relevant public signals.

### Step 4: Risk dashboard

The system displays an overview of the supplier portfolio.

Illustrative data:

  Classification     Supplier count
  ---------------- ----------------
  Low risk                       32
  Medium risk                    13
  High risk                       5
  **Total**                  **50**

### Step 5: Investigate a supplier

The manager opens a supplier profile and sees:

-   Financial risk indicators
-   Delivery performance concerns
-   Missing documentation
-   Relevant external news
-   Evidence and source dates
-   Data freshness and confidence

### Step 6: Ask the AI assistant

The manager asks:

> Why is Supplier Alpha considered high risk? What should we do?

Illustrative response:

> Supplier Alpha has an elevated risk score due to several identified
> concerns. Its delivery performance has deteriorated, and its latest
> available financial information requires further review. I recommend
> requesting updated financial documentation and identifying an
> alternative supplier for critical components.

The response is displayed as text, linked to evidence and spoken using
ElevenLabs.

### Step 7: Take action

SupplierLens proposes an action plan:

-   Request updated financial statements.
-   Contact the supplier.
-   Review outstanding orders.
-   Identify alternative suppliers.
-   Schedule a follow-up assessment.

All supplier names, scores and findings in this example are
illustrative, not real company information.

------------------------------------------------------------------------

# 5. Technology Stack

The recommended stack is designed for a fast MVP while keeping the
architecture extensible.

## 5.1 Frontend

  Technology       Purpose
  ---------------- ---------------------------
  Next.js 16       Web application
  TypeScript       Type safety
  Tailwind CSS 4   Styling
  shadcn/ui        Reusable UI components
  Recharts         Analytics and risk charts

## 5.2 Backend

  Technology   Purpose
  ------------ ---------------------------------
  Python       Core backend language
  FastAPI      REST APIs and orchestration
  Pydantic     Request and response validation
  SQLAlchemy   Database access

## 5.3 AI and RAG

  Technology         Purpose
  ------------------ --------------------------------------------------
  OpenAI or Claude   Language model and analysis
  LangGraph          Multi-step AI workflows
  Embeddings model   Semantic document representation
  RAG                Supplier-specific retrieval and grounded answers

## 5.4 Database and search

  Technology   Purpose
  ------------ --------------------------------------
  PostgreSQL   Relational business data
  pgvector     Vector search and document retrieval
  Exa API      External supplier research

## 5.5 Document processing

  Technology    Purpose
  ------------- --------------------------
  PyMuPDF       PDF extraction
  python-docx   Word document extraction
  openpyxl      Excel processing

## 5.6 Voice

  Technology                  Purpose
  --------------------------- -------------------------------------
  ElevenLabs Speech-to-Text   Voice transcription
  ElevenLabs Text-to-Speech   Spoken AI responses
  ElevenLabs Agents           Optional conversational voice agent

Check the current ElevenLabs API and SDK documentation for available
models, endpoint names, supported formats and pricing before
implementation.

## 5.7 Infrastructure

  Technology         Purpose
  ------------------ -----------------------------------------
  Docker             Consistent deployment
  Vercel             Frontend hosting
  AWS or Railway     Backend hosting
  Redis + Celery     Background document and monitoring jobs
  Auth.js or Clerk   Authentication

Avoid unnecessary microservices during the hackathon. A modular FastAPI
backend is sufficient.

------------------------------------------------------------------------

# 6. System Architecture

``` text
                    USER
                      |
                      v
             NEXT.JS FRONTEND
       Dashboard / Upload / Voice UI
                      |
               REST / WebSocket
                      |
                      v
                FASTAPI API
                      |
          Authentication / Tenant Access
                      |
                      v
             LANGGRAPH ORCHESTRATOR
                      |
       +--------------+---------------+
       |              |               |
       v              v               v
   SUPPLIER       DOCUMENT          EXTERNAL
   SERVICE        SERVICE           RESEARCH
       |              |               |
       |              v               v
       |         PDF / DOCX         EXA API
       |         EXTRACTION         PUBLIC WEB
       |              |
       |              v
       |         EMBEDDINGS
       |              |
       +--------------+---------------+
                      |
                      v
            POSTGRESQL + PGVECTOR
                      |
                      v
             RISK SCORING ENGINE
                      |
                      v
              GROUNDED LLM ANSWER
                      |
                      v
                ELEVENLABS
               TEXT TO SPEECH
                      |
                      v
               FRONTEND AUDIO
```

## Architecture principles

-   Keep business logic in the backend.
-   Use deterministic code for risk calculations.
-   Use the LLM for extraction, interpretation and natural-language
    explanations.
-   Retrieve supplier-specific evidence before generating answers.
-   Enforce tenant-level data isolation.
-   Keep API keys on the server.
-   Record provenance for external claims and document-derived facts.
-   Make voice an interface to the product, not a replacement for the
    risk engine.

------------------------------------------------------------------------

# 7. Suggested Project Structure

``` text
supplierlens/
│
├── frontend/
│   ├── app/
│   │   ├── dashboard/
│   │   ├── suppliers/
│   │   ├── suppliers/[id]/
│   │   ├── analytics/
│   │   └── assistant/
│   ├── components/
│   │   ├── dashboard/
│   │   ├── suppliers/
│   │   ├── risk/
│   │   └── voice/
│   ├── hooks/
│   ├── lib/
│   └── types/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   │   ├── document_service.py
│   │   │   ├── supplier_service.py
│   │   │   ├── risk_engine.py
│   │   │   ├── search_service.py
│   │   │   └── voice_service.py
│   │   ├── agents/
│   │   │   ├── supplier_agent.py
│   │   │   ├── risk_agent.py
│   │   │   └── research_agent.py
│   │   ├── rag/
│   │   ├── integrations/
│   │   │   ├── elevenlabs.py
│   │   │   └── exa.py
│   │   └── main.py
│   └── tests/
│
├── docker-compose.yml
└── README.md
```

------------------------------------------------------------------------

# 8. Initial API Design

Suggested endpoints:

  ------------------------------------------------------------------------------------------
  Method                  Endpoint                                   Purpose
  ----------------------- ------------------------------------------ -----------------------
  POST                    `/api/suppliers`                           Create supplier

  GET                     `/api/suppliers`                           List suppliers

  GET                     `/api/suppliers/{supplier_id}`             Get supplier profile

  POST                    `/api/suppliers/{supplier_id}/documents`   Upload documents

  POST                    `/api/suppliers/{supplier_id}/analyze`     Run supplier analysis

  GET                     `/api/suppliers/{supplier_id}/risk`        Get risk assessment

  GET                     `/api/suppliers/{supplier_id}/evidence`    Get supporting evidence

  POST                    `/api/suppliers/compare`                   Compare suppliers

  POST                    `/api/assistant/query`                     Submit text question

  POST                    `/api/assistant/voice`                     Submit voice
                                                                     interaction

  GET                     `/api/dashboard/overview`                  Get dashboard metrics
  ------------------------------------------------------------------------------------------

Adapt the contracts to the chosen frontend and voice implementation.

------------------------------------------------------------------------

# 9. Database Entities

Design relational schemas for:

1.  **Users** -- User identity and account details.
2.  **Organizations** -- Customer organizations and tenant boundaries.
3.  **Suppliers** -- Supplier profiles and identifiers.
4.  **SupplierDocuments** -- Uploaded document metadata and storage
    references.
5.  **DocumentChunks** -- Extracted and chunked document text with
    embeddings.
6.  **SupplierRiskAssessments** -- Overall and category-level risk
    assessments.
7.  **RiskIndicators** -- Individual risk factors and values.
8.  **ExternalSignals** -- Publicly retrieved supplier-related signals.
9.  **EvidenceSources** -- Source URLs, dates and supporting excerpts.
10. **AIConversations** -- Conversation sessions.
11. **AIConversationMessages** -- User and assistant messages.
12. **RiskAlerts** -- Alerts generated from assessments or new signals.
13. **ActionItems** -- Recommended and user-approved follow-up actions.

All tenant-owned records must be scoped to an organization. Implement
authorization checks on every relevant API operation.

------------------------------------------------------------------------

# 10. Product Design

## Visual direction

Build a premium enterprise SaaS interface.

Design characteristics:

-   Professional navy and white palette
-   Clean typography
-   Modern B2B dashboard
-   Clear risk status indicators
-   Data-rich but uncluttered layout
-   Interactive charts
-   Supplier comparison views
-   Evidence panels with source links
-   Dedicated AI assistant interface

## Pages

1.  Landing page
2.  Login and signup
3.  Dashboard
4.  Supplier directory
5.  Supplier detail page
6.  Document upload
7.  Risk analytics
8.  AI voice assistant
9.  Settings

## Dashboard components

-   Total suppliers
-   High-risk supplier count
-   Medium-risk supplier count
-   Low-risk supplier count
-   Supplier risk distribution
-   Recent risk alerts
-   Recently analysed suppliers
-   Missing or expiring documents
-   Recommended actions

------------------------------------------------------------------------

# 11. Business Potential

## 11.1 Market opportunity

The initial market is German manufacturing SMEs, followed by European
manufacturing and procurement businesses.

The opportunity is based on a hypothesis: smaller companies need
supplier intelligence but may find enterprise solutions too complex,
expensive or resource-intensive.

SupplierLens aims to offer a simpler, document-first and accessible
experience.

Market size and willingness to pay must be researched and validated
before making investor claims.

## 11.2 Business model

B2B SaaS subscription.

Proposed pricing hypotheses:

  Plan           Monthly price Target customer
  ------------ --------------- --------------------------
  Starter                  €49 Small businesses
  Growth                  €149 Growing SMEs
  Business                €399 Medium-sized companies
  Enterprise            Custom Larger procurement teams

Potential pricing variables:

-   Number of monitored suppliers
-   Monitoring frequency
-   Number of users
-   Document processing volume
-   Advanced analytics
-   Integrations
-   Voice assistant usage

## 11.3 Revenue scenarios

Illustrative scenarios, not forecasts:

    Customers   Average monthly revenue per customer       MRR
  ----------- -------------------------------------- ---------
           20                                    €99    €1,980
           50                                   €149    €7,450
          100                                   €199   €19,900
          250                                   €249   €62,250

At 100 customers paying €199 per month, annual recurring revenue would
be €238,800.

These calculations do not account for operating costs, churn, taxes or
acquisition costs.

## 11.4 Competitive landscape

Relevant companies include:

-   **Prewave:** Supply chain risk intelligence and monitoring.
-   **IntegrityNext:** Supply chain sustainability and compliance.
-   **Dun & Bradstreet:** Business information and risk intelligence.
-   **EcoVadis:** Sustainability ratings and assessments.

SupplierLens should not claim that these companies lack capabilities
without research.

Potential differentiation hypotheses:

1.  SME-focused accessibility.
2.  Fast document-based onboarding.
3.  Explainable AI risk assessments.
4.  Voice-based procurement intelligence.
5.  Evidence-backed recommendations.
6.  Affordable subscription tiers.

## 11.5 Go-to-market strategy

### Phase 1: Customer discovery

-   Interview 10--15 procurement managers.
-   Speak to manufacturing SMEs.
-   Understand current supplier evaluation processes.
-   Identify the most costly and frequent problems.
-   Test willingness to pay.

### Phase 2: Pilot customers

-   Offer supplier assessments to 3--5 companies.
-   Process sample supplier documents.
-   Demonstrate risk dashboards.
-   Collect feedback.
-   Measure usefulness and time saved.

### Phase 3: Paid subscriptions

-   Convert successful pilots into paying customers.
-   Offer monthly subscriptions.
-   Develop integrations based on actual customer demand.
-   Build referral partnerships with procurement consultants.

------------------------------------------------------------------------

# 12. Hackathon MVP Scope

The hackathon objective is to demonstrate one complete, convincing
workflow rather than build every proposed feature.

## Must-have features (P0)

-   Supplier dashboard
-   Supplier creation
-   PDF upload
-   Document extraction
-   AI-powered supplier analysis
-   External company search
-   Explainable risk score
-   Evidence and source citations
-   ElevenLabs voice interaction
-   AI-generated action plan

## Should-have features (P1)

-   Supplier comparison
-   Risk alerts
-   AI-generated reports
-   Historical assessments

## Future features (P2)

-   ERP integrations
-   Advanced analytics
-   Automated continuous monitoring
-   Custom risk models
-   Enterprise workflows

## Demo workflow

1.  Open SupplierLens.
2.  Create or select a supplier.
3.  Upload a sample supplier document.
4.  Extract information.
5.  Retrieve relevant external signals.
6.  Calculate the risk score.
7.  Display risk indicators and evidence.
8.  Ask a question through the microphone.
9.  Play the ElevenLabs voice response.
10. Show the recommended action plan.

The demo should use clearly labelled synthetic supplier data if real
data is unavailable.

------------------------------------------------------------------------

# 13. One-Day Execution Plan

  -----------------------------------------------------------------------
  Time                                Activity
  ----------------------------------- -----------------------------------
  10:00--10:45                        Select problem, define customer and
                                      validate assumptions

  10:45--11:30                        Interview 3--5 potential customers

  11:30--12:30                        Build backend, database and AI
                                      pipeline

  12:30--13:00                        Lunch

  13:00--15:00                        Build frontend and integrate APIs

  15:00--16:00                        Test and polish the end-to-end demo

  16:00--16:45                        Prepare pitch deck

  16:45--17:15                        Record demo video and submit
  -----------------------------------------------------------------------

Prioritize the working document-to-risk-to-voice workflow.

------------------------------------------------------------------------

# 14. Pitch Deck Structure

Recommended eight-slide presentation:

  -----------------------------------------------------------------------
  Slide                               Content
  ----------------------------------- -----------------------------------
  1                                   SupplierLens -- Know your suppliers
                                      before their risks become your
                                      problems

  2                                   Problem -- SMEs lack accessible,
                                      continuously updated supplier
                                      intelligence

  3                                   Customer -- German manufacturing
                                      and procurement SMEs

  4                                   Solution -- AI-powered supplier
                                      intelligence platform

  5                                   Product demo -- Documents →
                                      Intelligence → Risk → Voice AI

  6                                   Business model -- Recurring B2B
                                      SaaS subscriptions

  7                                   Competition and differentiation

  8                                   Customer validation, go-to-market
                                      and vision
  -----------------------------------------------------------------------

## 60-second pitch

Every business depends on suppliers, but most small and medium-sized
companies have no reliable way to understand when those suppliers become
a business risk.

Today, supplier information is scattered across spreadsheets, emails,
PDFs and websites. Procurement teams spend hours collecting information,
manually evaluating suppliers and reacting to problems after they
happen.

We are building SupplierLens, an AI-powered supplier intelligence
platform that brings all this information together.

Companies can upload supplier documents, automatically analyse financial
and operational indicators, monitor external risk signals and receive
explainable risk assessments with actionable recommendations.

But we go one step further: with our ElevenLabs-powered voice assistant,
procurement managers can simply ask questions like, "Which supplier is
putting my production at risk?" and receive evidence-backed answers.

We are starting with German manufacturing SMEs and building an
accessible alternative to complex enterprise supplier-risk solutions.

**SupplierLens: Know your suppliers before their risks become your
business problems.**

------------------------------------------------------------------------

# 15. Product and Engineering Guardrails

The product must follow these principles:

-   Never fabricate supplier data, financial information or risk
    indicators.
-   Every external claim must have a traceable source.
-   Separate verified facts, estimates and AI-generated interpretations.
-   Track source dates and data freshness.
-   Make risk scoring deterministic and explainable.
-   Do not treat missing information as evidence of low risk.
-   Protect API keys using environment variables or a secrets manager.
-   Implement authentication and tenant isolation.
-   Validate uploaded files and enforce file size/type limits.
-   Treat document contents and retrieved web content as untrusted
    input.
-   Do not allow external content to execute instructions or invoke
    privileged tools.
-   Require user authorization for consequential actions.
-   Use realistic demo data only when clearly labelled as synthetic.
-   Follow applicable privacy, data protection and security
    requirements.
-   Do not present SupplierLens assessments as guarantees or
    professional financial/legal advice.

------------------------------------------------------------------------

# 16. Key Risks and Open Questions

## Product risks

-   Public data may be incomplete, stale or unavailable.
-   Supplier names may be ambiguous and require entity resolution.
-   Financial information may not be available for every private
    company.
-   Risk scores may create false confidence if evidence is weak.
-   Document quality and formats may vary.
-   External search results may contain irrelevant or misleading claims.

## Business risks

-   SMEs may not have sufficient willingness to pay.
-   Existing procurement systems may already cover some workflows.
-   Customer acquisition may require trust and industry relationships.
-   Integrations may be necessary for adoption.
-   Continuous monitoring and data access may create significant costs.

## Questions to validate

1.  Which supplier-risk problem is most painful for the initial customer
    segment?
2.  How many suppliers does the typical target customer actively manage?
3.  Which data sources do customers trust?
4.  Which supplier documents are readily available?
5.  How frequently do customers need updated assessments?
6.  What would customers pay for this workflow?
7.  Is voice interaction a meaningful differentiator or primarily a demo
    feature?
8.  Which integrations are essential for adoption?

------------------------------------------------------------------------

# 17. Master Instructions for the AI Development Agent

Act as a senior startup CTO, AI architect, product strategist and
hackathon technical co-founder.

Your task is to design and implement SupplierLens based on this
specification.

## Your priorities

1.  Understand the customer problem and intended workflow.
2.  Propose the simplest robust architecture.
3.  Define database schemas and API contracts.
4.  Build the supplier dashboard and profile pages.
5.  Implement document upload and extraction.
6.  Implement supplier-specific RAG.
7.  Implement the deterministic risk scoring engine.
8.  Integrate Exa for external supplier research.
9.  Integrate ElevenLabs for voice interaction.
10. Implement evidence-backed recommendations.
11. Test the complete end-to-end workflow.
12. Prepare a compelling demo and pitch.

## Development approach

-   Do not overengineer.
-   Avoid unnecessary microservices.
-   Do not build all future features before the MVP works.
-   Keep the frontend and backend modular.
-   Keep business logic separate from LLM prompts.
-   Make all risk assessments traceable.
-   Use mock data only when clearly labelled.
-   Do not invent API capabilities or supplier facts.
-   Verify third-party API documentation before integration.
-   Provide clear setup instructions and environment variable examples.
-   Add tests for risk scoring, authorization and key workflows.

## Expected deliverables

1.  Product requirements document
2.  System architecture
3.  Database schema
4.  API contracts
5.  Frontend implementation
6.  Backend implementation
7.  AI/RAG pipeline
8.  ElevenLabs integration
9.  Risk scoring implementation
10. Working MVP
11. Demo script
12. Eight-slide pitch deck

**Start by proposing the implementation plan, database schema and API
contracts. Then build the smallest complete end-to-end workflow.**

------------------------------------------------------------------------

# Final Product Positioning

**SupplierLens is an AI-powered supplier intelligence platform for SMEs
that transforms supplier documents and public information into
explainable risk assessments, actionable recommendations and
conversational procurement intelligence.**

The central demo experience is:

**Upload a supplier document → Analyse supplier information → Identify
risk → Show supporting evidence → Ask the AI by voice → Receive an
actionable recommendation.**

This is the core product to build, validate and pitch.
