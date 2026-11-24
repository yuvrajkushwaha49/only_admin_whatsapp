# User Roles and Access Control (RBAC)

## User Roles Hierarchy
The platform implements strict Role-Based Access Control:
1. **Super Admin:** Platform owner with universal access across all client workspaces, number allocation, and system configurations.
2. **Owner:** Primary business account holder. Full authority over billing, team member management, numbers, and campaigns within their business workspace.
3. **Admin:** Workspace administrator managing team members, WhatsApp accounts, templates, and campaigns (restricted from billing/ownership transfers).
4. **Marketer:** Specialist role authorized to create templates, manage contacts, design campaigns, and inspect analytics.
5. **Agent:** Support representative with access to Team Inbox and customer messaging, without permissions to alter billing or campaign configurations.
