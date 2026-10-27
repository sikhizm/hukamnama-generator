import PolicyPage from "@/components/PolicyPage";
export const metadata = { title: "Terms of Service | Sikhizm Publisher" };
export default function Terms() {
  return <PolicyPage title="Terms of Service">
    <section><h2>Use of the service</h2><p>Sikhizm Publisher is a private content creation and publishing tool operated by Rajesh Singh for Sikhizm.com. Only authorized operators may use its protected tools. Use only accounts you own or are authorized to manage.</p></section>
    <section><h2>Content and responsibility</h2><p>You are responsible for checking scripture accuracy, translations, dates, captions and selected destinations before publication, and for having the rights and permissions needed for uploaded images, audio and other content. Follow each connected platform’s terms and applicable rules. Do not use the app for spam, impersonation or unauthorized access.</p></section>
    <section><h2>Publishing and automation</h2><p>Publishing sends content to external platforms and can make it public. Enabling automatic publishing authorizes the configured publishing actions. Source availability, platform processing and API restrictions can cause delays or failures. A successful upload does not guarantee public distribution, views, reach or earnings. Verify the destination before retrying an uncertain publishing result to avoid duplicates.</p></section>
    <section><h2>Availability and access</h2><p>The service and its integrations may change or become unavailable. Keep copies of important work. Access may be withdrawn for unauthorized use. No particular availability or publishing outcome is guaranteed.</p></section>
    <section><h2>Privacy and contact</h2><p>Read the <a href="/privacy">Privacy Policy</a> and <a href="/data-deletion">Data Deletion Instructions</a>. For questions, email <a href="mailto:rajeshkamboj33@gmail.com">rajeshkamboj33@gmail.com</a>.</p></section>
  </PolicyPage>;
}
