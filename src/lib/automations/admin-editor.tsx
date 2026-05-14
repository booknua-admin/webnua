import type { AutomationEditor } from './types';

const adminEditor: AutomationEditor = {
  id: 'follow-up-freshhome',
  eyebrow: '// FreshHome · 24-hour follow-up sequence',
  title: (
    <>
      Edit the <em>follow-up</em>.
    </>
  ),
  subtitle: (
    <>
      Three-step sequence that fires if a lead isn&apos;t booked within 24
      hours. <strong>Edit copy, change timing, add or remove steps.</strong>{' '}
      Use variables from the right rail to personalise each send. Test sends
      go to your phone, not the customer.
    </>
  ),
  trigger: {
    label: '// TRIGGER',
    name: 'Lead status = "New" for 24+ hours',
    changeLabel: 'Change trigger →',
  },
  steps: [
    {
      id: 'step-1',
      number: 1,
      channel: 'sms',
      delay: 'Delay: 24 hrs',
      name: 'Soft follow-up · check-in',
      body: (
        <>
          Hi <span data-slot="var">{'{first_name}'}</span> — still chasing a
          cleaner? I&apos;ve got a few slots free this week if you want me to
          come give your <span data-slot="var">{'{bedrooms}'}</span>-bed a
          once-over. Reply YES and I&apos;ll send a time. — Lisa
        </>
      ),
      footerMeta: '// 28% reply · 142 sent · last 7d',
      variables: ['{first_name}', '{bedrooms}'],
    },
    {
      id: 'step-2',
      number: 2,
      channel: 'email',
      delay: 'Delay: +48 hrs',
      name: 'Story + social proof',
      subject: 'Still need a cleaner, {first_name}?',
      body: (
        <>
          Just checking in. I had a chat with another customer last week with
          the same setup as yours —{' '}
          <span data-slot="var">{'{bedrooms}'}</span>-bed in{' '}
          <span data-slot="var">{'{suburb}'}</span>, weekly cleans — and we
          sorted it for under $200/fortnight.
          {'\n\n'}Happy to swing by this week if you&apos;re still looking.
          Just reply with a time that works.
          {'\n\n'}— Lisa · FreshHome · 268 reviews · 4.9 ★
        </>
      ),
      footerMeta: '// EDITING · auto-saved 8s ago',
      variables: ['{first_name}', '{bedrooms}', '{suburb}'],
      isEditing: true,
    },
    {
      id: 'step-3',
      number: 3,
      channel: 'sms',
      delay: 'Delay: +5 days',
      name: 'Last attempt · no pressure',
      body: (
        <>
          Last one from me — just checking you got sorted? If you went with
          someone else no worries, but if not I&apos;ve got Friday afternoon
          free. — Lisa
        </>
      ),
      footerMeta: '// 14% reply · 38 sent · last 7d',
      variables: ['{first_name}'],
    },
  ],
  addStepLabel: '+ Add another step (SMS / Email / Wait)',
  rail: {
    variables: {
      heading: '// AVAILABLE VARIABLES',
      items: [
        { code: '{first_name}', description: "Lead's first name" },
        { code: '{business}', description: 'Your business name' },
        { code: '{job_type}', description: 'What they asked for' },
        { code: '{bedrooms}', description: 'From form (if collected)' },
        { code: '{suburb}', description: 'From address field' },
        { code: '{est_price}', description: 'From pricing engine' },
        { code: '{review_link}', description: 'Google review URL' },
      ],
    },
    testSend: {
      heading: '// TEST SEND',
      body: (
        <>
          Send all 3 steps to your phone, instantly, so you can read them as a
          customer would. Won&apos;t reach real leads.
        </>
      ),
      buttonLabel: 'Send test to 0411 567 234',
    },
    performance: {
      heading: '// PERFORMANCE · 7D',
      metrics: [
        { label: 'Triggered', value: '86' },
        { label: 'Replies', value: '24 (28%)', tone: 'accent' },
        { label: '→ Booked', value: '11 (13%)', tone: 'good' },
      ],
    },
  },
  footer: {
    progress: (
      <>
        FreshHome · 24-hour follow-up · v4 ·{' '}
        <strong>auto-saved 8s ago</strong>
      </>
    ),
    backLabel: '← Back to all automations',
    backHref: '/automations',
    disableLabel: 'Disable flow',
    saveLabel: 'Save + apply to all leads',
  },
  testSend: {
    tag: '// TEST SEND · 24h follow-up · Step 2',
    title: (
      <>
        Test <em>before</em> going live
      </>
    ),
    subtitle: (
      <>
        Send a real SMS or email to your own number. Variables get sample
        values — your actual customers won&apos;t see this send.
      </>
    ),
    sendTo: '0414 891 027 (Craig — operator)',
    sendToHint:
      'Default: your verified operator number. Add another test recipient in Settings.',
    phoneBar: 'Today · 2:34 PM · from 04XX XXX XXX',
    smsPreview: (
      <>
        Hi Craig — still chasing a cleaner? I&apos;ve got a few slots free this
        week if you want me to come give your 3-bed a once-over. Reply YES and
        I&apos;ll send a time. — Lisa
      </>
    ),
    smsVariablesLine: (
      <>
        Variables filled:{' '}
        <span data-slot="var-list">
          {'{first_name}=Craig · {bedrooms}=3 · {business_owner}=Lisa'}
        </span>
      </>
    ),
    options: {
      title: <strong>Send as SMS only</strong>,
      sub: (
        <>
          For email steps, you can preview both rendered HTML and plain text.
          SMS is what your customers actually receive.
        </>
      ),
      switchLabel: 'Switch to email',
    },
    footerInfo: (
      <>
        Charges your Twilio credit (<strong>~$0.04</strong> for AU SMS). Not
        visible in customer-facing automation history.
      </>
    ),
    cancelLabel: 'Cancel',
    sendLabel: 'Send test now →',
  },
};

export { adminEditor };
