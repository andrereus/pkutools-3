---
name: Community Food Database
overview: MVP community food sharing - users toggle sharing on own foods, browse/vote on community foods in search, usage tracked from diary adds.
todos:
  - id: schemas
    content: Add shared field to OwnFoodSchema, create CommunityFoodSchema
    status: pending
  - id: firebase-rules
    content: Add communityFoods read access to database.rules.json
    status: pending
  - id: store
    content: Add communityFoods and communityVotes to Pinia store
    status: pending
  - id: api-own-food
    content: Modify own-food APIs to sync shared foods to communityFoods
    status: pending
  - id: api-vote
    content: Create server/api/community-food/vote.post.ts
    status: pending
  - id: own-food-ui
    content: Add share checkbox to own-food.vue
    status: pending
  - id: search-integration
    content: Add community foods to food-search.vue with voting
    status: pending
  - id: translations
    content: Add community strings to i18n locales
    status: pending
isProject: false
---

# Community Food Database - MVP

## Core Features

1. **Share toggle** on own foods (checkbox)
2. **Community foods in search** with language filter
3. **Like/dislike voting** (no comments for MVP)
4. **Usage count** from diary adds
5. **Auto-hide** foods with score < -3

## Data Model

### Own Food (add field)

```typescript
{
  // ... existing fields
  shared: boolean,
  communityKey: string | null
}
```

### Community Food

Path: `/communityFoods/{key}`

```typescript
{
  name: string,
  icon: string | null,
  phe: number,
  kcal: number,
  language: string,           // 'en' | 'de' | 'es' | 'fr'
  contributorId: string,      // For edit/delete permissions only (not displayed)
  ownFoodKey: string,
  createdAt: number,
  likes: number,
  dislikes: number,
  score: number,              // likes - dislikes
  usageCount: number,
  hidden: boolean
}
```

**Note:** Community foods are anonymous - no contributor name or personal info is shared.

### User Votes

Path: `/{userId}/communityVotes/{foodKey}`

```typescript
{
  vote: 1 | -1
}
```

## Implementation

### 1. Schema ([server/types/schemas.ts](server/types/schemas.ts))

Add `shared: z.boolean().default(false)` to OwnFoodSchema.

### 2. Firebase Rules ([database.rules.json](database.rules.json))

```json
"communityFoods": {
  ".read": "auth != null",
  ".write": false
}
```

### 3. Store ([stores/index.js](stores/index.js))

Add `communityFoods` array and `communityVotes` object with Firebase listeners.

### 4. Own Food APIs

**save/update.post.ts:**

- If `shared: true`: create/update in `/communityFoods` with user's language
- If `shared: false`: remove from `/communityFoods`
- If phe/kcal changed on shared food: reset votes to 0
- Check duplicates before sharing (same name + language + similar phe)

**delete.post.ts:**

- If shared: also remove from `/communityFoods`

**reset.post.ts (settings):**

- Skip foods with `shared: true`

### 5. Vote API - `server/api/community-food/vote.post.ts`

```typescript
// Input: { communityFoodKey: string, vote: 1 | -1 }
// Toggle vote, update likes/dislikes/score atomically
// If score < -3: set hidden = true
```

### 6. Diary API - `server/api/diary/food-items.post.ts`

Add optional `communityFoodKey` to input. If provided, increment `usageCount`.

### 7. Own Food UI ([app/pages/own-food.vue](app/pages/own-food.vue))

In the **edit dialog** (not table): Add checkbox "Share with community" with helper text showing language.

### 8. Food Search ([app/pages/food-search.vue](app/pages/food-search.vue))

**In table:**

- Include community foods (filtered by user's language, exclude hidden)
- Show community badge on community food rows

**In detail dialog (after clicking a food):**

- Show vote count (likes/dislikes)
- Like/dislike buttons
- When user clicks "Add", pass `communityFoodKey` to diary API → increments usage count

### 9. Translations

```json
{
  "community": {
    "share": "Share with community",
    "shareLanguage": "Will be shared in {language}",
    "like": "Like",
    "dislike": "Dislike",
    "communityFood": "Community",
    "duplicateError": "Similar food already exists"
  }
}
```

## Security

- All input validated with Zod (max 200 chars name)
- `contributorId` set server-side from Auth token (not displayed to users)
- No personal info shared - contributions are anonymous
- Vue `{{ }}` auto-escapes (no XSS)
- Community foods read-only for clients
- Auto-hide at score < -3

## Files to Change

| File | Change |

|------|--------|

| `server/types/schemas.ts` | Add shared field |

| `database.rules.json` | Add communityFoods rules |

| `stores/index.js` | Add community state |

| `server/api/own-food/*.ts` | Sync to community |

| `server/api/community-food/vote.post.ts` | New - voting |

| `server/api/diary/food-items.post.ts` | Track usage |

| `server/api/settings/reset.post.ts` | Preserve shared |

| `app/pages/own-food.vue` | Share checkbox |

| `app/pages/food-search.vue` | Show community foods |

| `i18n/locales/*.json` | Translations |

## Deferred to Post-MVP

- Comments on dislikes
- Notifications to creators
- Source field
- Sorting/filtering options
- Dedicated community browse page
