---
name: Community Food Database
overview: Community food database with sharing toggle on own foods, likes/dislikes with visible comments, diary-based usage tracking, language localization, and smart sorting/filtering.
todos:
  - id: schemas
    content: Update OwnFoodSchema with shared, source fields; add CommunityFoodSchema, VoteSchema, CommentSchema
    status: pending
  - id: firebase-rules
    content: Update database.rules.json with communityFoods, communityComments read access
    status: pending
  - id: store
    content: Add communityFoods, communityVotes, communityComments to Pinia store
    status: pending
  - id: api-own-food
    content: Modify own-food save/update/delete APIs to handle sharing, sync to communityFoods with language
    status: pending
  - id: api-vote
    content: Create server/api/community-food/vote.post.ts (like/dislike with optional visible comment)
    status: pending
  - id: api-diary
    content: Modify diary food-items API to increment community food usage count
    status: pending
  - id: api-composable
    content: Add community API functions to app/composables/useApi.ts
    status: pending
  - id: own-food-ui
    content: Add share checkbox and source field to own-food.vue form
    status: pending
  - id: search-integration
    content: Update food-search.vue with community foods, voting UI, comments, sorting/filtering by language
    status: pending
  - id: notifications
    content: Add notification system for food creators when someone comments
    status: pending
  - id: settings-reset
    content: Modify settings reset to preserve shared foods
    status: pending
  - id: translations
    content: Add community feature strings to i18n/locales/*.json
    status: pending
isProject: false
---

# Community Food Database

## Overview

Users can:

1. Mark their own foods as "shared" via checkbox - syncs to community database with their language
2. Edit/unshare their foods (editing phe/kcal resets votes)
3. Like or dislike community foods (dislike with visible comment notifies creator)
4. Find community foods in food search, filtered by language, sorted by metrics
5. Add community foods to diary (tracks usage count)

## Architecture

```mermaid
flowchart TB
    subgraph ui [UI]
        OwnFood[own-food.vue<br/>share checkbox + source]
        FoodSearch[food-search.vue<br/>filter by language]
        Diary[diary.vue]
    end

    subgraph api [API]
        SaveAPI[/api/own-food/save<br/>syncs with language]
        UpdateAPI[/api/own-food/update<br/>syncs + reset votes]
        DeleteAPI[/api/own-food/delete<br/>removes from community]
        VoteAPI[/api/community-food/vote]
        DiaryAPI[/api/diary/food-items<br/>increments usage]
    end

    subgraph db [Firebase]
        OwnFoods[/userId/ownFood]
        CF[/communityFoods]
        UV[/userId/communityVotes]
        Comments[/communityFoods/key/comments]
        Notif[/userId/notifications]
    end

    OwnFood --> SaveAPI --> OwnFoods
    SaveAPI -->|if shared| CF
    FoodSearch --> VoteAPI --> CF
    VoteAPI --> UV
    VoteAPI -->|if comment| Comments
    VoteAPI -->|notify creator| Notif
    Diary --> DiaryAPI -->|if community food| CF
```

## Data Model

### Own Food Entry (Updated)

Path: `/{userId}/ownFood/{foodKey}`

```typescript
{
  // Existing fields
  name: string,
  icon: string | null,
  phe: number,
  kcal: number,
  note: string | null,

  // New fields
  shared: boolean,            // Checkbox: share to community
  source: string | null,      // e.g., "Brand X nutrition label"
  communityKey: string | null // Reference to communityFoods entry if shared
}
```

### Community Food Entry

Path: `/communityFoods/{foodKey}`

```typescript
{
  // Food data (copied from own food)
  name: string,
  icon: string | null,
  phe: number,
  kcal: number,
  note: string | null,
  source: string | null,

  // Localization
  language: string,           // 'en' | 'de' | 'es' | 'fr' (from user's locale when shared)

  // Contributor info
  contributorId: string,
  contributorName: string,
  ownFoodKey: string,         // Reference back to contributor's ownFood

  // Timestamps
  createdAt: number,
  updatedAt: number,

  // Metrics
  likes: number,
  dislikes: number,
  usageCount: number,         // Times added to diary by any user
  score: number,              // likes - dislikes (for sorting)

  // Moderation
  hidden: boolean             // Auto-hidden when score < -3
}
```

### Community Food Comments

Path: `/communityFoods/{foodKey}/comments/{commentKey}`

```typescript
{
  authorId: string,
  authorName: string,
  comment: string,
  createdAt: number
}
```

Comments are visible to everyone and associated with dislikes (feedback for the creator).

### User Vote Tracking

Path: `/{userId}/communityVotes/{communityFoodKey}`

```typescript
{
  vote: 1 | -1,               // 1 = like, -1 = dislike
  votedAt: number
}
```

### User Notifications

Path: `/{userId}/notifications/{notificationKey}`

```typescript
{
  type: 'community_comment' | 'food_hidden',
  communityFoodKey: string,
  communityFoodName: string,
  commenterName?: string,     // For comment notifications
  comment?: string,           // For comment notifications
  reason?: string,            // For hidden notifications
  createdAt: number,
  read: boolean
}
```

## Implementation Steps

### 1. Schema Updates ([server/types/schemas.ts](server/types/schemas.ts))

Update OwnFoodSchema:

```typescript
export const OwnFoodSchema = z.object({
  name: z.string().min(1).max(200),
  icon: z.string().nullable(),
  phe: z.number().nonnegative(),
  kcal: z.number().nonnegative(),
  note: z.string().max(500).nullable(),
  // New fields
  shared: z.boolean().default(false),
  source: z.string().max(200).nullable()
})

export const CommunityCommentSchema = z.object({
  comment: z.string().min(1).max(500)
})
```

### 2. Firebase Rules ([database.rules.json](database.rules.json))

```json
{
  "communityFoods": {
    ".read": "auth != null",
    ".write": false,
    "$foodKey": {
      "comments": {
        ".read": "auth != null"
      }
    }
  }
}
```

### 3. Pinia Store ([stores/index.js](stores/index.js))

Add:

- `communityFoods: []` - All shared community foods
- `communityVotes: {}` - Current user's votes
- `notifications: []` - Current user's notifications

### 4. Own Food API Updates

**save.post.ts** - When `shared: true`:

- Get user's current language from request headers or settings
- Check for duplicates in communityFoods (same name + language + similar phe)
- Create entry in `/communityFoods` with `language` field
- Store `communityKey` reference in own food

**update.post.ts** - When updating shared food:

- If `shared` changed to false: remove from communityFoods
- If `shared` changed to true: create in communityFoods
- If `phe` or `kcal` changed: reset likes/dislikes/score to 0, delete comments (keep usageCount)
- If only name/icon/note/source changed: update without resetting

**delete.post.ts** - When deleting shared food:

- Also remove from communityFoods (including comments subcollection)

### 5. Vote API - `server/api/community-food/vote.post.ts`

Input:

```typescript
{
  communityFoodKey: string,
  vote: 1 | -1,
  comment?: string            // Optional, visible feedback (typically with dislikes)
}
```

Logic:

- Toggle vote on/off, or switch vote direction
- Update communityFoods likes/dislikes/score atomically
- If comment provided:
  - Add to `/communityFoods/{key}/comments`
  - Create notification for contributor at `/{contributorId}/notifications`

### 6. Diary API Update ([server/api/diary/food-items.post.ts](server/api/diary/food-items.post.ts))

When adding a food item to diary:

- Check if the food has a `communityFoodKey` reference
- If yes, increment `usageCount` on that community food

Input schema update:

```typescript
{
  // Existing fields...
  communityFoodKey?: string   // Optional: reference to community food being used
}
```

### 7. API Composable ([app/composables/useApi.ts](app/composables/useApi.ts))

```typescript
async function voteCommunityFood(key: string, vote: 1 | -1, comment?: string): Promise<void>

async function markNotificationRead(key: string): Promise<void>
```

### 8. Own Food UI ([app/pages/own-food.vue](app/pages/own-food.vue))

Add to food form/dialog:

- **Source field**: Text input, placeholder "e.g., Brand name, nutrition label"
- **Share checkbox**: "Share with community" with help text
- Info text: "Will be shared in [current language]"
- Warning when editing shared food with phe/kcal changes

### 9. Food Search ([app/pages/food-search.vue](app/pages/food-search.vue))

**Display community foods:**

- Visual badge for community foods
- Show: likes, dislikes, usage count, contributor name
- Like/dislike buttons
- View comments link (expandable or modal)
- When adding to diary, pass `communityFoodKey` to track usage

**Language filtering:**

- By default, show community foods matching user's current language
- Toggle/option to show all languages
- Language indicator on foods from other languages

**Sorting options:**

- Most popular (by score)
- Most used (by usageCount)
- Newest (by createdAt)
- Best match (Fuse.js relevance)

**Filtering:**

- Toggle community foods on/off
- Filter by minimum score

**Dislike with comment flow:**

- Click dislike → show textarea: "Leave feedback for the creator (visible to everyone)"
- Submit creates visible comment + notifies creator

### 10. Notifications UI

Add notification indicator/dropdown (could be in header or settings):

- Show unread count badge
- List recent notifications
- Click notification → navigate to food in search
- Mark as read on view

### 11. Settings Reset ([server/api/settings/reset.post.ts](server/api/settings/reset.post.ts))

Modify ownFood reset:

- Only delete own foods where `shared !== true`
- Shared foods preserved to maintain community integrity
- Show message explaining shared foods are kept

### 12. Duplicate Prevention

Check duplicates within same language:

```typescript
const duplicateCheck = await db
  .ref('communityFoods')
  .orderByChild('language')
  .equalTo(userLanguage)
  .once('value')

const allInLanguage = duplicateCheck.val() || {}
for (const [key, existing] of Object.entries(allInLanguage)) {
  if (
    normalizeString(existing.name) === normalizeString(newFood.name) &&
    Math.abs(existing.phe - newFood.phe) / Math.max(existing.phe, 1) < 0.05
  ) {
    throw createError({
      statusCode: 409,
      message: 'A similar food already exists in the community'
    })
  }
}
```

### 13. Translations

```json
{
  "community": {
    "share": "Share with community",
    "shareHelp": "Make this food available to all PKU Tools users",
    "shareLanguage": "Will be shared in {language}",
    "shared": "Shared with community",
    "unshare": "Stop sharing",
    "source": "Source",
    "sourcePlaceholder": "e.g., Brand name, nutrition label",
    "likes": "{count} likes",
    "dislikes": "{count} dislikes",
    "usageCount": "Used {count} times",
    "like": "Like",
    "dislike": "Dislike",
    "communityFood": "Community",
    "allLanguages": "All languages",
    "sortBy": "Sort by",
    "sortPopular": "Most popular",
    "sortUsed": "Most used",
    "sortNewest": "Newest",
    "commentPrompt": "Leave feedback for the creator (visible to everyone)",
    "comments": "Comments",
    "noComments": "No comments yet",
    "duplicateError": "A similar food already exists in the community",
    "editWarning": "Changing nutritional values will reset votes and comments",
    "sharedFoodsKept": "Shared foods are preserved to maintain community data",
    "notification": {
      "newComment": "{name} commented on your food \"{food}\"",
      "foodHidden": "Your food \"{food}\" was hidden due to too many dislikes"
    },
    "hidden": "This food is hidden due to community feedback"
  }
}
```

## Files Summary

| File | Action | Purpose |

| ---------------------------------------- | ------ | --------------------------------------------- |

| `server/types/schemas.ts` | Modify | Add shared, source, comment schemas |

| `database.rules.json` | Modify | Add communityFoods with comments rules |

| `stores/index.js` | Modify | Add communityFoods, votes, notifications |

| `server/api/own-food/save.post.ts` | Modify | Sync to community with language |

| `server/api/own-food/update.post.ts` | Modify | Sync updates, reset votes/comments on phe/kcal|

| `server/api/own-food/delete.post.ts` | Modify | Remove from community |

| `server/api/community-food/vote.post.ts` | Create | Like/dislike with visible comment + notify |

| `server/api/diary/food-items.post.ts` | Modify | Increment community food usage count |

| `server/api/settings/reset.post.ts` | Modify | Preserve shared foods |

| `app/composables/useApi.ts` | Modify | Add community API functions |

| `app/pages/own-food.vue` | Modify | Share checkbox, source field |

| `app/pages/food-search.vue` | Modify | Community foods, voting, comments, filtering |

| `app/components/Notifications.vue` | Create | Notification dropdown/list |

| `i18n/locales/*.json` | Modify | Add translations |

## Security

### Input Handling

All user input is validated server-side with Zod schemas:

| Field | Max Length | Validation |

|-------|------------|------------|

| name | 200 chars | Required, trimmed |

| source | 200 chars | Optional |

| note | 500 chars | Optional |

| comment | 500 chars | Required if provided |

**XSS Prevention:**

- Vue templates use `{{ }}` interpolation which auto-escapes HTML
- No `v-html` is used for user-generated content
- All text is treated as text, not HTML

**Identity Verification:**

- `contributorId` and `contributorName` are set server-side from Firebase Auth token
- Client cannot spoof contributor identity
- Auth token verified on every API call via `getAuthenticatedUser()`

**Database Security:**

- Firebase rules: `communityFoods` is read-only for clients
- All writes via Firebase Admin SDK on server
- User can only read their own votes/notifications

### Content Moderation

**Auto-hide threshold:**

- Foods with `score < -3` (3+ net dislikes) are hidden from search results by default
- Add `hidden: true` flag to community food when threshold reached
- Creator notified when food is hidden
- Creator can edit food (resets votes) to try again

Implementation in food search:

```typescript
// Filter out hidden foods by default
const visibleFoods = communityFoods.filter((food) => !food.hidden && food.score >= -3)
```

Update vote API to check threshold:

```typescript
// After updating score
if (updatedScore < -3 && !food.hidden) {
  await foodRef.update({ hidden: true })
  // Notify creator their food was hidden
  await notifyCreator(food.contributorId, {
    type: 'food_hidden',
    communityFoodKey: foodKey,
    communityFoodName: food.name,
    reason: 'Too many dislikes'
  })
}
```

### Data Integrity

- `communityKey` reference ensures own food and community food stay in sync
- Deleting own food removes community entry
- Unsharing removes community entry but keeps own food
- Atomic updates for vote counts prevent race conditions

## Quality Control Summary

- **Likes/Dislikes**: Visible counts, score-based sorting surfaces quality
- **Auto-hide**: Foods with 3+ net dislikes hidden from results
- **Visible comments**: Feedback from dislikers is public, creates accountability
- **Creator notifications**: Food creators notified of comments and hiding
- **Usage tracking**: Based on actual diary usage
- **Language localization**: Foods tagged by language, filtered by default
- **Duplicate prevention**: Per-language duplicate check
- **Vote/comment reset on edit**: Prevents gaming by editing nutritional values
- **Shared food protection**: Can't accidentally delete via bulk reset
- **Server-side validation**: All input validated with Zod, identity from Auth token
