process.env.DB_HOST = "ep-lucky-bar-aw5wr0cn.c-12.us-east-1.aws.neon.tech";
process.env.DB_USER = "neondb_owner";
process.env.DB_PASSWORD = "npg_rExYDGS14fPO";
process.env.DB_NAME = "neondb";
process.env.DB_SSL = "true";
const db = require("../src/config/db");
(async () => {
  const { rows: users } = await db.query(
    `SELECT id, fullname, email, role, active FROM public.users WHERE lower(email) = $1`,
    ["rafael.ortiz@fam-project.com"]
  );
  console.log("Usuario:", JSON.stringify(users, null, 2));

  const { rows: workspaces } = await db.query(
    `SELECT id, name, owner_user_id FROM work_management.workspaces ORDER BY created_at ASC`
  );
  console.log("Total workspaces:", workspaces.length);
  console.log(JSON.stringify(workspaces, null, 2));

  if (users.length) {
    const { rows: existingMemberships } = await db.query(
      `SELECT workspace_id, member_role, is_active FROM work_management.workspace_members WHERE user_id = $1`,
      [users[0].id]
    );
    console.log("Membresias existentes de rafael:", JSON.stringify(existingMemberships, null, 2));
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
