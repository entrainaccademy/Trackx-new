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
- Removed the **My Conversions & Sales Log** section from the team-member page.
- Removed the **Record New Sale** button and its sales-entry form from the team-member page.

## Data behavior

- Uses the `workStats` and `tasks` returned by the authenticated `/api/team-member` endpoint.
- Uses backend-calculated counts so the API and dashboard always show the same totals.
- Urgent task cards are built from the endpoint's `tasks` array.
- No database schema or migration was required.

## Files changed

- `src/app/team-member/page.tsx`
- `SALES_MEMBER_DASHBOARD_CHANGES.md`
