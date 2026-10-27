import PolicyPage from "@/components/PolicyPage";
export const metadata = { title: "Data Deletion | Sikhizm Publisher" };
export default function DataDeletion() {
  return <PolicyPage title="Data Deletion Instructions">
    <section><h2>Request deletion</h2><p>Email <a href="mailto:rajeshkamboj33@gmail.com?subject=Sikhizm%20Publisher%20data%20deletion">rajeshkamboj33@gmail.com</a> with the subject “Sikhizm Publisher data deletion”. Identify the platform and account username or public account URL, and describe the app-held data you want removed. Do not send a password, access token or identity document. We may ask for confirmation of account control before acting and will reply with the outcome or any information needed.</p></section>
    <section><h2>Disconnect and revoke access</h2><p>Use Disconnect in the app where available, and remove Sikhizm Publisher from the connected platform’s app permissions or business integrations. Server-configured credentials must also be removed by the operator from hosting settings and the app redeployed. Revoking access prevents further authorized API use but does not itself erase all saved drafts or records.</p></section>
    <section><h2>Remove browser data</h2><p>Sign out and clear this app’s site data in your browser to remove local drafts, preferences, saved media, publishing history and connection cookies. Repeat on each device or browser profile where you used the app. Clearing site data removes saved work.</p></section>
    <section><h2>Published content and logs</h2><p>Delete already published posts directly on the relevant social platform. App data deletion does not automatically delete those posts or copies held by others. Operational logs and backups, if present, follow the hosting provider’s retention and deletion capabilities. We will explain any information that cannot be removed immediately when responding to your request.</p></section>
  </PolicyPage>;
}
