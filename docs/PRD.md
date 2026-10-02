# WeHobby PRD

Sep 29, 2026 · @Giovanna Damasceno

## Overview

A mobile first web app (installable on the phone home screen as a PWA) where people share and talk only about their hobbies, with one official community per hobby and a way to see what people nearby are doing.

**Problem.** People who love a hobby have nowhere comfortable to share the everyday side of it. Instagram and Facebook feel like a showcase for special moments and status, so a half finished crochet piece or a plant that just died never gets posted. Facebook groups exist, but they are fragmented (dozens of groups per hobby), mixed with unrelated content, and hard to filter by place or style.

**Solution.** One community per hobby, curated by the platform, with a feed you can filter by "near me" and by hobby type. Posting is a simple photo plus text, no editing or filters, so sharing feels spontaneous. Everything on the app is about hobbies and nothing else.

**Positioning.** Instagram is for showing off; this app is for doing, learning and swapping ideas with people who share your hobby.

|  | Instagram / Facebook | Facebook groups | This app |
| --- | --- | --- | --- |
| Content | Everything in your life | Mixed, often off topic | Only hobbies |
| Communities per hobby | None | Many, fragmented | Exactly one, platform owned |
| Local discovery | Weak | Depends on the group | Near me filter in every community |
| Posting pressure | High (filters, curation) | Medium | Low (raw photo plus text) |

## Goals and non goals

The MVP proves one thing: hobbyists will post everyday progress and talk to each other when the space is hobby only and local.

**Goals for the MVP**

1. Launch as a mobile first web app with 3 hobby communities: crochet, plants, and photography.
2. Let a new user sign up, pick hobbies and see a relevant feed in under 2 minutes.
3. Make posting a photo take under 30 seconds, with no editing step.
4. Create conversations: comments on posts are the main engagement signal.
5. Make local discovery work from day one with a "near me" filter.

**Non goals for the MVP**

- Direct messages, meetups and events (planned for later).
- User created hobbies or sub groups. The platform owns the hobby list.
- Selling, payments or shop partnerships.
- Photo editing, filters, stories or video.
- Native iOS and Android apps (planned after the MVP, see the roadmap).

## Target users and personas

The core user is an adult hobbyist who practices regularly, shares little on mainstream social media, and wants to learn from and talk to people with the same hobby.

**Giovanna, 29, crochet.** Uses Instagram and Facebook only for special moments. Wants to:

- Share finished pieces and keep them as a portfolio.
- Explain how she made something (pattern, technique, yarn).
- Talk about yarns and discover where others buy them.
- See what other people are making and get ideas.

**Beatriz, 27, plants.** Wants to:

- Share her plants and track how they grow over time.
- Post honestly about the ones that died and ask why.
- Learn care tips from people with similar plants and climate.

**What they have in common:** the spontaneous moment. A row just finished, a new leaf, a plant that did not make it. Small updates that are too ordinary for Instagram but perfect for people who care about the same hobby.

## Product principles

Every feature decision is checked against these four rules.

1. **Hobbies only.** Posts must belong to a hobby community. There is no general "life" feed and no posting outside a hobby.
2. **One community per hobby.** The platform creates and owns each community. Filters (location, type) replace the need for duplicate groups.
3. **No pressure posting.** Photos go up as taken: no filters, no editing, no stories. Likes and follower counts exist, but they are not the centre of the experience.
4. **Conversation over status.** Comments, questions and tips matter more than reach. The feed rewards helpful and recent posts, not popular accounts.

## MVP scope

The MVP has seven features. Anything not in this table waits for a later phase.

| # | Feature | Requirements | Done when |
| --- | --- | --- | --- |
| 1 | Sign up and log in | Email and Google sign in. Username, display name, optional avatar and bio. User must confirm they are 16 or older. App language: Portuguese or English, chosen by the user and changeable in settings. | A new user can create an account and log back in on another device. |
| 2 | Pick hobbies | Choose one or more of the 3 official hobbies at onboarding; edit later in profile. Per hobby, optionally pick types (for example amigurumi, tapestry, granny squares). The platform maintains the type list; users can suggest new types, which the platform reviews. | The home feed only shows the chosen hobbies. |
| 3 | Set location | Ask for location permission or let the user type a city. Store an approximate location only. | The near me filter works for users who share location and for users who typed a city. |
| 4 | Post a photo | 1 to 5 photos taken with the phone camera or picked from the gallery (the browser offers both), a text caption, a required hobby, an optional hobby type. Optional fields: materials used (for example yarn brand), where bought. No filters or editing. | A post appears in its community feed within seconds. |
| 5 | Community feed | One feed per hobby, sorted by newest (default) or nearest. Filters: near me (radius 10, 25, 50 km or country) and hobby type. A home feed mixes the user's hobbies and followed people. | A user can filter crochet posts to amigurumi within 25 km. |
| 6 | Interact | Like, comment, reply to a comment, follow a person. Notifications for new comments, replies and followers: a notification bell inside the app, plus optional web push. | A user is notified when someone comments on their post. |
| 7 | Profile and portfolio | Grid of the user's posts, filterable by hobby. Shows hobbies, approximate area, follower and following counts. | Giovanna can share her profile as a crochet portfolio. |

Safety features (report, block, delete own content, delete account) are part of the MVP and described in the Safety and moderation section.

## Key user flows

The MVP has three core flows, each four steps from the first tap to a visible result.

&#91;embedded content: core user flows · join, post, talk\]

Location is optional in the join flow; without it, the near me filter falls back to country wide results.

## Data model and location privacy

The MVP needs nine tables; location is stored as an approximate point, never the exact address.

| Entity | Key fields |
| --- | --- |
| User | id, username, display name, avatar, bio, approximate location, city label, created at |
| Hobby | id, name, icon, active (platform managed) |
| Hobby type | id, hobby id, name (for example amigurumi, succulents) |
| User hobby | user id, hobby id, selected types |
| Post | id, author id, hobby id, hobby type id, caption, materials, where bought, approximate location, created at |
| Post photo | id, post id, image url, order |
| Comment | id, post id, author id, parent comment id (for replies), text, created at |
| Like / Follow | user id, target id, created at |
| Report / Block | reporter id, target type, target id, reason, status |

**Location rules**

- Round coordinates to about 1 km (or use the city centre) before saving.
- Show only the city or area name on profiles and posts, never a map pin.
- Strip EXIF metadata (including GPS) from every uploaded photo.
- Location is optional; users without it simply do not see the near me filter.
- Because users are in Portugal and the EU, the app must follow GDPR: clear consent for location, a privacy policy, data export and account deletion.

## Technical approach

All infrastructure runs on Azure in an EU region (for GDPR). For the MVP, WeHobby is a mobile first web app instead of native apps: it avoids app store fees and review cycles, and one codebase works on every phone and computer.

&#91;embedded content: Azure architecture · web MVP\]

The app only ever talks to Entra (to sign in), the API, and Blob Storage (to upload photos with a short lived SAS link from the API). Everything else runs behind the API.

| Layer | Azure service | Why |
| --- | --- | --- |
| Web app | React + TypeScript (Vite) as a PWA, hosted on Azure Static Web Apps (Free plan) | Free hosting with the wehobby.app domain and HTTPS; works in any phone browser and can be added to the home screen like an app |
| Sign in | Microsoft Entra External ID | Email and Google sign in through the browser. Apple sign in can be added when native apps launch, where the App Store requires it ([Microsoft](https://devblogs.microsoft.com/identity/now-generally-available-apple-identity-provider-support-for-microsoft-entra-external-id/)) |
| API | Azure Container Apps (Node.js + TypeScript) | Scales to zero when idle; validates Entra tokens and checks that users only edit their own content |
| Database | Azure Database for PostgreSQL Flexible Server + PostGIS extension | Relational data plus fast "within X km" queries for the near me filter; Burstable tier for the MVP |
| Photos | Azure Blob Storage | Private container; the browser uploads directly with a SAS link, so photos never pass through the API |
| Image processing | Azure Functions, triggered by Event Grid on each upload | Creates thumbnails, strips EXIF and GPS data, sends images to moderation |
| Moderation | Azure AI Content Safety | Screens text and images for harmful content before they appear |
| Notifications | Web Push, sent by the API (VAPID keys in Key Vault) | No extra Azure service. On iPhone, push only works after the user adds the app to the home screen; the in app notification bell works everywhere |
| Secrets and access | Azure Key Vault + managed identities | No passwords or keys in code; services authenticate to each other |
| Monitoring | Application Insights | Errors, slow requests and usage from the web app, API and Functions |
| Infrastructure as code | Terraform (azurerm) + GitHub Actions, remote state in Azure Storage | The whole environment can be recreated from the repo; separate dev and prod resource groups |
| Photo delivery (later) | Azure Front Door | Add a CDN when traffic grows; skip at MVP to avoid its monthly base fee |

**Why web first:** no Apple (99 USD per year) or Google Play (25 USD) developer fees, no store review for every release, instant updates, and payments without store commissions. The trade offs: people find WeHobby through links instead of the app stores, and some phone features (like push on iPhone) need the app added to the home screen. Writing the web app in React and TypeScript keeps the door open to native apps later with React Native, reusing the API, data types and most of the logic.

**Working with Claude Code**

1. Keep this PRD in the repo (for example `docs/PRD.md`) and a `CLAUDE.md` with the stack, Azure resource names and conventions.
2. Put all infrastructure in Terraform under `infra/`, deployed by GitHub Actions with OIDC federated credentials (no stored Azure secrets); plan on every pull request, apply after merge.
3. Build feature by feature in the MVP scope order, with tests for each; every write endpoint checks ownership.

**Accounts and costs to plan for:** the wehobby.app domain and an Azure subscription. Static Web Apps (Free plan) and the Container Apps monthly free grant keep hosting close to zero at MVP scale; the PostgreSQL server is likely the main monthly cost. Estimate the rest with the Azure pricing calculator.

## Safety and moderation

Reporting, blocking and content removal ship in the MVP. They protect users from day one and are also required by Apple and Google when native apps launch later.

- **Report:** any post, comment or profile, with a reason (spam, harassment, inappropriate, off topic).
- **Block:** hides the blocked user's content and stops them interacting with you.
- **Delete:** users can delete their own posts, comments and account (also a GDPR requirement).
- **Off topic rule:** posts must relate to the hobby; off topic reports are reviewed like any other.
- **Automated screening:** Azure AI Content Safety checks photos and text for nudity, violence and hate at upload; spam is caught with simple rate limits in the API.
- **Admin review:** a simple admin view (a small internal admin page on the same API is enough at first) to review reports and remove content within 24 hours.
- **Age:** minimum age 16 for the EU launch; confirmed at sign up.
- **Community guidelines:** a short, friendly page shown at onboarding.

## Monetization

The MVP is free with no ads; revenue starts after launch through shop partnerships and a marketplace commission.

| Model | How it works | When |
| --- | --- | --- |
| Shop partnerships | Yarn shops, garden centres and hobby stores get a verified profile and can offer discounts or sponsored posts in their hobby community, clearly labelled | Phase 2 |
| Marketplace commission | Users sell handmade items, supplies or cuttings; the platform takes a percentage of each sale | Phase 3 |
| Paid trainings and workshops | Creators sell workshops (in person or online); the platform takes a percentage | Phase 3 |

**Payments:** as a web app, every payment (physical goods, in person services and online courses) can go through an external provider like Stripe, with no app store fee. When native apps launch, digital content bought inside them usually has to use Apple and Google in app purchases, which take a 15 to 30 percent fee, so check the store rules at that point.

The item fields captured in the MVP (materials used, where bought) create the data that partnerships can build on later.

## Success metrics

Success in the first 3 months after launch means people come back weekly and talk to each other, not just scroll.

| Metric | What it shows | Target (first 3 months) |
| --- | --- | --- |
| Weekly active users | People come back | To set once the launch audience is known |
| Share of weekly users who post | Posting feels easy and safe | 20% or more |
| Posts with at least one comment | Conversation is happening | 50% or more |
| Day 30 retention | The app is part of the hobby routine | 20% or more |
| Time to first post after sign up | Onboarding works | Under 10 minutes for new posters |
| Users with location set | Local discovery can work | 60% or more |

## Roadmap after the MVP

Each phase starts only when the one before it shows people post and comment regularly.

1. **Phase 1, MVP:** the seven features above, 3 hobbies, as a mobile first web app.
2. **Phase 2, connect:** native iOS and Android apps, direct messages, saved posts, search, more hobbies (for example wake surf), shop partner profiles.
3. **Phase 3, meet and trade:** local meetups and events, marketplace for items and trainings, creator tools.
4. **Phase 4, grow:** hobby specific tools (for example a plant growth timeline, a pattern library), recommendations.

## Decisions and risks

**Decisions**

| Question | Decision |
| --- | --- |
| App name | WeHobby, domain wehobby.app. No registered trademark found in TMview. Next: file an EU trademark (classes 9 and 42) |
| Platform for the MVP | Mobile first web app (PWA) on Azure, to avoid app store costs; native iOS and Android apps in phase 2 |
| Third hobby at launch | Photography (with crochet and plants) |
| Launch audience | Portuguese and English speaking users; each user picks the app language |
| Hobby types | The platform maintains the list; users can send suggestions for review |
| Feed order | Newest by default, with a nearest option |

**Risks**

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Empty feeds at launch | A social app with no posts loses new users fast | Seed each community with posts from friends and early testers, start with only 3 hobbies |
| Near me shows nothing | Few users per area early on | Fall back to country wide results when fewer than 10 posts are nearby |
| Moderation load | Reports need a fast response and one person runs everything | Automated screening plus a simple admin view; clear guidelines |
| Harder to discover as a web app | No App Store or Google Play listing where people search | Share links through Instagram and hobby groups; build native apps once people post regularly |
| iPhone web limits | Push only works after adding the app to the home screen, and Safari behaves differently | In app notification bell, a friendly "add to home screen" prompt, test on iPhone Safari from day one |
| Solo build scope creep | Features pile up before launch | Hold the MVP scope table; everything else goes to the roadmap |
