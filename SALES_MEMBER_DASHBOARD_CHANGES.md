# Sales Member Dashboard Changes

Date: 5 August 2026

## What was added

- Added a **My Important Work** section to the `/team-member` sales-member portal.
- Added live counters for:
  - Open tasks
  - Follow-ups due today
  - Overdue tasks
  - High-priority tasks
- Added a **Needs Your Attention** list showing up to four urgent tasks.
- Urgent items show the task title, lead, due date/time, and an Overdue or High badge.
- Added an **Update Stage** action to urgent tasks. It opens the existing lead-details window where the member can change the stage, schedule the next follow-up, and add notes.
- Added a refresh action and loading state while task information is being fetched.
- Added an all-caught-up message when there are no overdue or high-priority tasks.

## Data behavior

- Uses the existing authenticated `/api/tasks/optimized` endpoint.
- Loads tasks assigned to either the sales member's email or employee code.
- Deduplicates tasks when both identifiers return the same assignment.
- Counts only active work; completed and skipped tasks are excluded.
- No database schema or migration was required.

## Files changed

- `src/app/team-member/page.tsx`
- `SALES_MEMBER_DASHBOARD_CHANGES.md`
