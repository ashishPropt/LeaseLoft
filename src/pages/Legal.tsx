import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Legal = () => {
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash?.replace("#", "");
    if (hash) {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash]);

  const isTerms = location.pathname === "/terms";
  const pageTitle = isTerms ? "Terms of Use | LeaseLoft" : "Privacy Policy | LeaseLoft";
  const pageDesc = isTerms
    ? "LeaseLoft Terms of Use governing access to our AI-powered property management platform."
    : "How LeaseLoft collects, uses, and protects your personal information.";

  useEffect(() => {
    document.title = pageTitle;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", pageDesc);
  }, [pageTitle, pageDesc]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container flex items-center justify-between h-16">
          <Logo size="sm" to="/" />
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4" /> Back home
            </Link>
          </Button>
        </div>
      </header>

      <main className="container max-w-3xl py-10 lg:py-14">
        {/* In-page nav */}
        <nav className="flex gap-2 mb-8">
          <Button
            variant={!isTerms ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link to="/privacy">Privacy Policy</Link>
          </Button>
          <Button
            variant={isTerms ? "default" : "outline"}
            size="sm"
            asChild
          >
            <Link to="/terms">Terms of Use</Link>
          </Button>
        </nav>

        <article className="prose prose-slate dark:prose-invert max-w-none">
          {!isTerms ? <PrivacyContent /> : <TermsContent />}
        </article>

        <div className="mt-12 pt-6 border-t border-border text-sm text-muted-foreground">
          {isTerms ? (
            <>
              See also our{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </>
          ) : (
            <>
              See also our{" "}
              <Link to="/terms" className="text-primary hover:underline">
                Terms of Use
              </Link>
              .
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="container py-8 flex items-center justify-between text-sm text-muted-foreground">
          <Logo size="sm" to="/" />
          <div>© {new Date().getFullYear()} LeaseLoft™</div>
        </div>
      </footer>
    </div>
  );
};

/* ---------------- Content components ---------------- */

const H1 = ({ children }: { children: React.ReactNode }) => (
  <h1 className="text-4xl font-medium tracking-tight text-foreground mb-2">{children}</h1>
);
const H2 = ({ id, children }: { id?: string; children: React.ReactNode }) => (
  <h2 id={id} className="text-2xl font-medium tracking-tight text-foreground mt-10 mb-3 scroll-mt-20">
    {children}
  </h2>
);
const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-base text-muted-foreground leading-relaxed mb-4">{children}</p>
);
const UL = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc pl-6 space-y-1.5 text-muted-foreground mb-4 leading-relaxed">{children}</ul>
);
const Strong = ({ children }: { children: React.ReactNode }) => (
  <span className="text-foreground font-medium">{children}</span>
);

const PrivacyContent = () => (
  <>
    <div className="text-sm text-muted-foreground mb-1">LeaseLoft™</div>
    <H1>Privacy Policy</H1>
    <p className="text-sm text-muted-foreground mb-8">Effective Date: April 30, 2026</p>

    <H2 id="introduction">1. Introduction</H2>
    <P>
      LeaseLoft, a product offering by Biz Pioneers LLC ("LeaseLoft," "we," "our," or "us") is committed to
      protecting the privacy of our users. This Privacy Policy explains how we collect, use, disclose, and
      safeguard information when you use our website and platform at leaseloft.com (the "Platform"), including
      our AI-assisted lease generation, rent payment processing, maintenance request tracking, and
      landlord-tenant messaging services.
    </P>
    <P>
      By accessing or using LeaseLoft, you agree to the collection and use of information in accordance with
      this Privacy Policy. If you do not agree, please discontinue use of the Platform.
    </P>

    <H2 id="who-we-are">2. Who We Are</H2>
    <P>
      LeaseLoft operates a secure, AI-powered property management workspace that serves both individual
      consumers (tenants, individual landlords) and businesses (property management companies, real estate
      investors). We are headquartered in the United States and our services are directed at users in the
      United States.
    </P>

    <H2 id="information-we-collect">3. Information We Collect</H2>
    <P>We collect the following categories of personal information:</P>
    <P><Strong>Account &amp; Identity Information:</Strong></P>
    <UL>
      <li>Full name, email address, phone number, and account credentials</li>
      <li>Government-issued ID for identity verification (where applicable)</li>
      <li>Business name, address, and tax identification number (for business users)</li>
    </UL>
    <P><Strong>Property &amp; Lease Information:</Strong></P>
    <UL>
      <li>Property addresses, rental unit details, and lease terms</li>
      <li>Documents uploaded to the Platform, including lease agreements</li>
      <li>Maintenance requests, photos, and related communications</li>
    </UL>
    <P><Strong>Payment Information:</Strong></P>
    <UL>
      <li>Bank account details, routing numbers, and payment card information (processed via PCI-compliant third-party processors)</li>
      <li>Rent payment history and transaction records</li>
    </UL>
    <P><Strong>Usage &amp; Technical Information:</Strong></P>
    <UL>
      <li>IP address, browser type, device identifiers, and operating system</li>
      <li>Pages visited, features used, and time spent on the Platform</li>
      <li>Log data and cookies (see Section 8 for Cookie Policy)</li>
    </UL>
    <P><Strong>AI-Generated Data:</Strong></P>
    <UL>
      <li>Inputs provided to our AI lease generation tools and outputs produced</li>
      <li>Interaction data used to improve AI model performance (in anonymized or aggregated form)</li>
    </UL>

    <H2 id="how-we-use">4. How We Use Your Information</H2>
    <P>We use collected information to:</P>
    <UL>
      <li>Provide, operate, and improve the LeaseLoft Platform and its features</li>
      <li>Process rent payments and maintain transaction records</li>
      <li>Generate and manage lease agreements using AI-assisted tools</li>
      <li>Facilitate communication between landlords and tenants</li>
      <li>Track and manage maintenance requests</li>
      <li>Verify user identity and prevent fraud</li>
      <li>Send account-related notifications, updates, and support communications</li>
      <li>Comply with applicable laws, regulations, and legal obligations</li>
      <li>Analyze usage patterns to improve Platform performance and personalization</li>
      <li>Train and refine AI models using anonymized or aggregated data</li>
    </UL>

    <H2 id="legal-basis">5. Legal Basis for Processing (U.S. State Privacy Laws)</H2>
    <P>
      For users in states with comprehensive privacy laws (including California under the CCPA/CPRA, Virginia,
      Colorado, Connecticut, and others), we process your personal information based on:
    </P>
    <UL>
      <li>Performance of a contract (to provide our services)</li>
      <li>Compliance with legal obligations</li>
      <li>Our legitimate business interests (e.g., fraud prevention, security, improving the Platform)</li>
      <li>Your consent, where explicitly required</li>
    </UL>

    <H2 id="sharing">6. Sharing and Disclosure of Information</H2>
    <P>
      <Strong>We do not sell your personal information.</Strong> We may share your information with:
    </P>
    <UL>
      <li><Strong>Service Providers:</Strong> Third-party vendors assisting with payment processing, cloud hosting, identity verification, customer support, and analytics, under contractual data protection obligations</li>
      <li><Strong>Other Users:</Strong> Landlords and tenants may see each other's contact information and communications necessary for their rental relationship</li>
      <li><Strong>Legal Requirements:</Strong> We may disclose information to comply with applicable law, court orders, or government requests</li>
      <li><Strong>Business Transfers:</Strong> In connection with a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction</li>
      <li><Strong>With Your Consent:</Strong> For any other purpose with your explicit consent</li>
    </UL>

    <H2 id="retention">7. Data Retention</H2>
    <P>
      We retain personal information for as long as necessary to provide our services and fulfill the purposes
      described in this Privacy Policy, or as required by law. Lease and payment records may be retained for up
      to seven (7) years to comply with legal and accounting requirements. You may request deletion of your
      account and data subject to our retention obligations.
    </P>

    <H2 id="cookies">8. Cookies and Tracking Technologies</H2>
    <P>LeaseLoft uses cookies, pixel tags, and similar technologies to:</P>
    <UL>
      <li>Maintain session state and user authentication</li>
      <li>Analyze usage and improve the Platform</li>
      <li>Deliver relevant functionality and personalization</li>
    </UL>
    <P>
      You may control cookies through your browser settings. Disabling certain cookies may affect Platform
      functionality.
    </P>

    <H2 id="rights">9. Your Privacy Rights</H2>
    <P>Depending on your state of residence, you may have the following rights:</P>
    <UL>
      <li><Strong>Right to Know:</Strong> Request information about the personal data we collect, use, and share</li>
      <li><Strong>Right to Access:</Strong> Obtain a copy of your personal information</li>
      <li><Strong>Right to Delete:</Strong> Request deletion of your personal information, subject to legal exceptions</li>
      <li><Strong>Right to Correct:</Strong> Request correction of inaccurate personal information</li>
      <li><Strong>Right to Opt-Out of Sale/Sharing:</Strong> We do not sell personal information, but you may opt out of sharing for cross-context behavioral advertising</li>
      <li><Strong>Right to Non-Discrimination:</Strong> We will not discriminate against you for exercising your privacy rights</li>
    </UL>
    <P>
      To exercise your rights, please contact us at{" "}
      <a href="mailto:info@bizpioneers.net" className="text-primary hover:underline">info@bizpioneers.net</a>.
      We will respond within 45 days as required by applicable law.
    </P>

    <H2 id="ai">10. AI Features and Automated Decision-Making</H2>
    <P>
      LeaseLoft uses artificial intelligence to assist with lease generation and to personalize your experience.
      AI-generated lease documents are provided as a starting point and should be reviewed by qualified legal
      counsel before execution. We do not use fully automated decision-making that produces legal effects on
      users without human review.
    </P>
    <P>
      Inputs you provide to AI features may be used in anonymized or aggregated form to improve model accuracy
      and platform performance. You may opt out of AI model training by contacting us at{" "}
      <a href="mailto:info@bizpioneers.net" className="text-primary hover:underline">info@bizpioneers.net</a>.
    </P>

    <H2 id="security">11. Security</H2>
    <P>
      We implement commercially reasonable technical and organizational security measures, including encryption
      in transit and at rest, access controls, and regular security assessments, to protect your personal
      information. No method of transmission over the internet is 100% secure. In the event of a data breach
      affecting your rights, we will notify you as required by applicable law.
    </P>

    <H2 id="children">12. Children's Privacy</H2>
    <P>
      The LeaseLoft Platform is not directed to individuals under the age of 18. We do not knowingly collect
      personal information from minors. If we become aware that we have collected information from a minor, we
      will delete it promptly.
    </P>

    <H2 id="changes">13. Changes to This Privacy Policy</H2>
    <P>
      We may update this Privacy Policy from time to time. We will notify you of material changes by posting the
      updated policy on our website with a revised effective date and, where appropriate, by sending an email
      notification. Continued use of the Platform after changes constitutes acceptance of the updated policy.
    </P>

    <H2 id="contact">14. Contact Us</H2>
    <P>
      If you have questions, concerns, or requests regarding this Privacy Policy, please contact:
    </P>
    <P>
      <Strong>Biz Pioneers, LLC</Strong>
      <br />
      Attn: Privacy Officer
      <br />
      Email:{" "}
      <a href="mailto:info@bizpioneers.net" className="text-primary hover:underline">info@bizpioneers.net</a>
    </P>
  </>
);

const TermsContent = () => (
  <>
    <div className="text-sm text-muted-foreground mb-1">LeaseLoft™</div>
    <H1>Terms of Use</H1>
    <p className="text-sm text-muted-foreground mb-8">Effective Date: April 30, 2026</p>

    <H2 id="acceptance">1. Acceptance of Terms</H2>
    <P>
      These Terms of Use ("Terms") constitute a legally binding agreement between you ("User," "you," or "your")
      and LeaseLoft, a product offering by Biz Pioneers LLC ("LeaseLoft," "we," or "us") governing your access
      to and use of the LeaseLoft platform, website, and services (collectively, the "Platform"). By creating an
      account, accessing, or using the Platform, you agree to be bound by these Terms and our Privacy Policy.
      If you do not agree, do not use the Platform.
    </P>

    <H2 id="eligibility">2. Eligibility</H2>
    <P>
      You must be at least 18 years of age and legally capable of entering into binding contracts to use the
      Platform. By using LeaseLoft, you represent and warrant that you meet these requirements. Business users
      represent that they have the authority to bind their organization to these Terms.
    </P>

    <H2 id="account-registration">3. Account Registration</H2>
    <P>To access certain features of the Platform, you must create an account. You agree to:</P>
    <UL>
      <li>Provide accurate, current, and complete information during registration</li>
      <li>Maintain and promptly update your account information</li>
      <li>Keep your login credentials confidential and not share them with third parties</li>
      <li>Notify us immediately at <a href="mailto:info@bizpioneers.net" className="text-primary hover:underline">info@bizpioneers.net</a> of any unauthorized access to your account</li>
      <li>Accept responsibility for all activity that occurs under your account</li>
    </UL>

    <H2 id="services">4. Description of Services</H2>
    <P>LeaseLoft provides a secure, AI-powered workspace that includes:</P>
    <UL>
      <li><Strong>AI-Assisted Lease Generation:</Strong> Tools to help draft residential and commercial lease agreements. AI-generated documents are provided for informational purposes only and do not constitute legal advice. You are responsible for reviewing documents with qualified legal counsel before execution.</li>
      <li><Strong>Rent Payment Processing:</Strong> Facilitation of rent payments between landlords and tenants through third-party payment processors. LeaseLoft is not a bank or money services business.</li>
      <li><Strong>Maintenance Request Tracking:</Strong> A system for tenants to submit and landlords to manage property maintenance requests.</li>
      <li><Strong>Landlord-Tenant Messaging:</Strong> Secure in-platform communication tools between landlords and tenants.</li>
    </UL>
    <P>
      LeaseLoft reserves the right to modify, suspend, or discontinue any feature or service at any time with
      reasonable notice.
    </P>

    <H2 id="acceptable-use">5. Acceptable Use</H2>
    <P>
      You agree to use the Platform only for lawful purposes and in accordance with these Terms. You agree NOT
      to:
    </P>
    <UL>
      <li>Violate any applicable federal, state, or local laws or regulations, including fair housing laws (Fair Housing Act, 42 U.S.C. § 3601 et seq.)</li>
      <li>Use the Platform to discriminate against any person based on race, color, national origin, religion, sex, familial status, disability, or any other protected class</li>
      <li>Upload or transmit false, misleading, or fraudulent information</li>
      <li>Attempt to gain unauthorized access to the Platform or other users' accounts</li>
      <li>Use automated tools (bots, scrapers) to access the Platform without our written consent</li>
      <li>Interfere with or disrupt the integrity, security, or performance of the Platform</li>
      <li>Use the Platform to send unsolicited commercial communications</li>
      <li>Reverse engineer, decompile, or disassemble any part of the Platform</li>
    </UL>

    <H2 id="ai-disclaimers">6. AI Features – Important Disclaimers</H2>
    <P>
      LeaseLoft's AI-powered tools are designed to assist users with lease drafting and platform personalization.
      You acknowledge and agree that:
    </P>
    <UL>
      <li>AI-generated lease documents are templates and starting points, not legal advice</li>
      <li>LeaseLoft makes no representations that AI-generated content is accurate, complete, legally sufficient, or enforceable in your jurisdiction</li>
      <li>You are solely responsible for reviewing, modifying, and obtaining legal counsel regarding any lease agreement before execution</li>
      <li>AI outputs may contain errors, omissions, or outdated legal language</li>
      <li>LeaseLoft is not liable for any loss, damage, or legal consequence arising from reliance on AI-generated content</li>
    </UL>

    <H2 id="payments">7. Payments and Fees</H2>
    <P>
      LeaseLoft may charge fees for access to certain features or tiers of the Platform. All fees are disclosed
      prior to purchase. Rent payments processed through the Platform are subject to the terms of our
      third-party payment processor. LeaseLoft is not responsible for payment processing errors caused by
      third-party processors. Fees paid to LeaseLoft are non-refundable except as required by applicable law or
      expressly stated in our refund policy.
    </P>

    <H2 id="user-content">8. User Content</H2>
    <P>
      You retain ownership of content you upload to the Platform ("User Content"), including lease documents,
      photos, and communications. By uploading User Content, you grant LeaseLoft a non-exclusive, royalty-free,
      worldwide license to use, store, display, and process your User Content solely to provide the Platform's
      services. You represent and warrant that you have all rights necessary to grant this license and that
      your User Content does not violate any third-party rights or applicable law.
    </P>

    <H2 id="ip">9. Intellectual Property</H2>
    <P>
      The LeaseLoft name, logo, platform design, software, and all content created by LeaseLoft (excluding User
      Content) are owned by Biz Pioneers, LLC and protected by applicable intellectual property laws. You may
      not copy, reproduce, distribute, or create derivative works from LeaseLoft's proprietary content without
      our prior written consent.
    </P>

    <H2 id="third-parties">10. Third-Party Services</H2>
    <P>
      The Platform integrates with third-party services, including payment processors and identity verification
      providers. These third parties have their own terms of service and privacy policies, which you agree to
      review and accept. LeaseLoft is not responsible for the acts or omissions of third-party service
      providers.
    </P>

    <H2 id="warranties">11. Disclaimers of Warranties</H2>
    <P className="uppercase">
      THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
      INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, OR
      NON-INFRINGEMENT. LEASELOFT DOES NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE
      OF VIRUSES OR HARMFUL COMPONENTS. YOUR USE OF THE PLATFORM IS AT YOUR SOLE RISK.
    </P>

    <H2 id="liability">12. Limitation of Liability</H2>
    <P className="uppercase">
      TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, LEASELOFT AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND
      AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES
      ARISING OUT OF OR RELATED TO YOUR USE OF THE PLATFORM, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA,
      GOODWILL, OR OTHER INTANGIBLE LOSSES, EVEN IF LEASELOFT HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH
      DAMAGES. LEASELOFT'S TOTAL LIABILITY TO YOU FOR ALL CLAIMS SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT
      YOU PAID TO LEASELOFT IN THE TWELVE MONTHS PRECEDING THE CLAIM OR (B) ONE HUNDRED DOLLARS ($100).
    </P>

    <H2 id="indemnification">13. Indemnification</H2>
    <P>
      You agree to indemnify, defend, and hold harmless LeaseLoft and its officers, directors, employees, and
      agents from and against any claims, damages, losses, liabilities, costs, and expenses (including
      reasonable attorneys' fees) arising out of or related to: (a) your use of the Platform; (b) your User
      Content; (c) your violation of these Terms; or (d) your violation of any applicable law or third-party
      rights.
    </P>

    <H2 id="arbitration">14. Dispute Resolution &amp; Arbitration</H2>
    <P className="uppercase">
      ANY DISPUTE, CLAIM, OR CONTROVERSY ARISING OUT OF OR RELATING TO THESE TERMS OR THE PLATFORM SHALL BE
      RESOLVED BY BINDING ARBITRATION ADMINISTERED BY THE AMERICAN ARBITRATION ASSOCIATION (AAA) UNDER ITS
      CONSUMER OR COMMERCIAL ARBITRATION RULES, AS APPLICABLE, RATHER THAN IN COURT. YOU WAIVE ANY RIGHT TO A
      JURY TRIAL AND ANY RIGHT TO PARTICIPATE IN A CLASS ACTION. THIS ARBITRATION AGREEMENT DOES NOT APPLY TO
      CLAIMS THAT MAY BE BROUGHT IN SMALL CLAIMS COURT.
    </P>
    <P>
      Arbitration shall take place in the state of [your state], and judgment on the award may be entered in
      any court having jurisdiction. Nothing in this section prevents either party from seeking injunctive
      relief in court to protect intellectual property or confidential information.
    </P>

    <H2 id="governing-law">15. Governing Law</H2>
    <P>
      These Terms shall be governed by and construed in accordance with the laws of the United States and the
      state of [your state], without regard to its conflict of law provisions.
    </P>

    <H2 id="modifications">16. Modifications to Terms</H2>
    <P>
      LeaseLoft reserves the right to modify these Terms at any time. We will provide notice of material
      changes by posting the updated Terms on our website with a revised effective date. Continued use of the
      Platform after the effective date constitutes your acceptance of the modified Terms.
    </P>

    <H2 id="termination">17. Termination</H2>
    <P>
      LeaseLoft may suspend or terminate your access to the Platform at any time, with or without cause or
      notice, if we determine you have violated these Terms or applicable law. Upon termination, your right to
      use the Platform ceases. Provisions that by their nature should survive termination shall do so,
      including Sections 6, 9, 11, 12, 13, 14, and 15.
    </P>

    <H2 id="entire-agreement">18. Entire Agreement</H2>
    <P>
      These Terms, together with our Privacy Policy and any additional agreements you enter into with
      LeaseLoft, constitute the entire agreement between you and LeaseLoft regarding the Platform and supersede
      all prior agreements.
    </P>

    <H2 id="contact">19. Contact Us</H2>
    <P>For questions about these Terms, please contact:</P>
    <P>
      <Strong>Biz Pioneers, LLC</Strong>
      <br />
      Attn: Legal Department
      <br />
      Email:{" "}
      <a href="mailto:info@bizpioneers.net" className="text-primary hover:underline">info@bizpioneers.net</a>
    </P>
    <P className="text-xs text-muted-foreground mt-8">© 2026 Biz Pioneers, LLC. All rights reserved.</P>
  </>
);

export default Legal;
