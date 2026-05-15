'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { AutomationAddStep } from '@/components/admin/automations/AutomationAddStep';
import { AutomationEditorLayout } from '@/components/admin/automations/AutomationEditorLayout';
import { AutomationEditorStep } from '@/components/admin/automations/AutomationEditorStep';
import { AutomationPerformanceCard } from '@/components/admin/automations/AutomationPerformanceCard';
import { AutomationStepConnector } from '@/components/admin/automations/AutomationStepConnector';
import { AutomationTestSendCard } from '@/components/admin/automations/AutomationTestSendCard';
import { AutomationTriggerBox } from '@/components/admin/automations/AutomationTriggerBox';
import { AutomationVariableList } from '@/components/admin/automations/AutomationVariableList';
import { EditorFooterActions } from '@/components/shared/EditorFooterActions';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { adminEditor } from '@/lib/automations/admin-editor';
import { useRole } from '@/lib/auth/user-stub';

export default function AutomationEditorPage() {
  const { role, hydrated } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && role === 'client') router.replace('/automations');
  }, [hydrated, role, router]);

  if (!hydrated || role !== 'admin') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-paper">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// Resolving role…'}
        </div>
      </div>
    );
  }

  const editor = adminEditor;

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Workspace', 'Automations']}
            current="Edit flow"
          />
        }
      />
      <div className="flex flex-col px-10 py-10">
        <PageHeader
          eyebrow={editor.eyebrow}
          title={editor.title}
          subtitle={editor.subtitle}
        />
        <AutomationEditorLayout
          canvas={
            <>
              <AutomationTriggerBox trigger={editor.trigger} />
              {editor.steps.map((step) => (
                <div key={step.id}>
                  <AutomationStepConnector />
                  <AutomationEditorStep step={step} />
                </div>
              ))}
              <div className="mt-5">
                <AutomationAddStep label={editor.addStepLabel} />
              </div>
            </>
          }
          rail={
            <>
              <AutomationVariableList
                heading={editor.rail.variables.heading}
                items={editor.rail.variables.items}
              />
              <AutomationTestSendCard
                heading={editor.rail.testSend.heading}
                body={editor.rail.testSend.body}
                buttonLabel={editor.rail.testSend.buttonLabel}
                data={editor.testSend}
              />
              <AutomationPerformanceCard
                heading={editor.rail.performance.heading}
                metrics={editor.rail.performance.metrics}
              />
            </>
          }
        />
        <EditorFooterActions
          progress={editor.footer.progress}
          actions={
            <>
              <Button variant="ghost" asChild>
                <Link href={editor.footer.backHref}>
                  {editor.footer.backLabel}
                </Link>
              </Button>
              <Button variant="secondary">{editor.footer.disableLabel}</Button>
              <Button>{editor.footer.saveLabel}</Button>
            </>
          }
        />
      </div>
    </>
  );
}
