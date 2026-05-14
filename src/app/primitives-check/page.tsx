'use client';

import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectGroup,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eyebrow } from '@/components/ui/eyebrow';
import { StatusDot } from '@/components/ui/status-dot';
import { Switch } from '@/components/ui/switch';

function Section({
  label,
  number,
  children,
}: {
  label: string;
  number: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-rule pt-10 pb-12">
      <div className="mb-6 flex items-baseline gap-4">
        <Eyebrow bullet>
          {number} · {label}
        </Eyebrow>
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-6">
      <div className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-quiet uppercase">
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export default function PrimitivesCheckPage() {
  const [switchOn, setSwitchOn] = React.useState(true);
  const [labeledSwitch, setLabeledSwitch] = React.useState(true);

  return (
    <TooltipProvider>
      <main className="mx-auto max-w-5xl px-8 py-16">
        <header className="mb-10">
          <Eyebrow bullet>Phase 3 · primitive layer</Eyebrow>
          <h1 className="mt-4 text-5xl font-bold uppercase tracking-tight">
            /primitives-check
          </h1>
          <p className="mt-4 max-w-2xl text-ink-mid">
            Every primitive in <code className="font-mono text-sm">src/components/ui/</code>,
            in every variant + state. Visual reference for review against the
            prototypes — page is deleted before final commit.
          </p>
        </header>

        <Section number="01" label="Button (shadcn)">
          <Row label="Variants">
            <Button variant="default">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Destructive</Button>
          </Row>
          <Row label="Sizes">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="icon">
              ★
            </Button>
          </Row>
          <Row label="Disabled">
            <Button disabled>Primary</Button>
            <Button variant="secondary" disabled>
              Secondary
            </Button>
            <Button variant="outline" disabled>
              Outline
            </Button>
          </Row>
        </Section>

        <Section number="02" label="Input (shadcn)">
          <Row label="Default">
            <Input placeholder="Placeholder text" className="max-w-sm" />
          </Row>
          <Row label="With value">
            <Input defaultValue="A typed value" className="max-w-sm" />
          </Row>
          <Row label="Disabled">
            <Input
              placeholder="Disabled"
              disabled
              className="max-w-sm"
            />
          </Row>
          <Row label="Invalid">
            <Input
              aria-invalid="true"
              defaultValue="bad@value"
              className="max-w-sm"
            />
          </Row>
        </Section>

        <Section number="03" label="Textarea (shadcn)">
          <Row label="Default">
            <Textarea placeholder="Body text…" className="max-w-md" />
          </Row>
          <Row label="With value">
            <Textarea
              defaultValue={`Multi-line\nmono content\nlives here.`}
              className="max-w-md"
            />
          </Row>
          <Row label="Disabled">
            <Textarea placeholder="Disabled" disabled className="max-w-md" />
          </Row>
        </Section>

        <Section number="04" label="Select (shadcn)">
          <Row label="Default">
            <Select>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Pick a value" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Group A</SelectLabel>
                  <SelectItem value="one">One</SelectItem>
                  <SelectItem value="two">Two</SelectItem>
                  <SelectItem value="three">Three</SelectItem>
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Group B</SelectLabel>
                  <SelectItem value="four">Four</SelectItem>
                  <SelectItem value="five">Five</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Small">
            <Select>
              <SelectTrigger size="sm" className="w-[180px]">
                <SelectValue placeholder="Small" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one">One</SelectItem>
                <SelectItem value="two">Two</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Disabled">
            <Select disabled>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Disabled" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one">One</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </Section>

        <Section number="05" label="Dialog (shadcn — 3 sizes)">
          <Row label="Small (480)">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open small</Button>
              </DialogTrigger>
              <DialogContent size="sm">
                <DialogHeader>
                  <DialogTitle>Small dialog</DialogTitle>
                  <DialogDescription>
                    480px max — short confirmations, single-action prompts.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button>Continue</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Row>
          <Row label="Default (560)">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open default</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Default dialog</DialogTitle>
                  <DialogDescription>
                    560px max — most modal forms in the platform.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                  <Input placeholder="Field 1" />
                  <Input placeholder="Field 2" />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Row>
          <Row label="Large (920)">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open large</Button>
              </DialogTrigger>
              <DialogContent size="lg">
                <DialogHeader>
                  <DialogTitle>Large dialog</DialogTitle>
                  <DialogDescription>
                    920px max — Proof Page tool, audit reviews, multi-pane forms.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Left pane</CardTitle>
                    </CardHeader>
                    <CardContent>Content A</CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Right pane</CardTitle>
                    </CardHeader>
                    <CardContent>Content B</CardContent>
                  </Card>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button>Continue</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Row>
        </Section>

        <Section number="06" label="Card (shadcn)">
          <div className="grid grid-cols-2 gap-4 max-w-3xl">
            <Card>
              <CardHeader>
                <CardTitle>Card title</CardTitle>
                <CardDescription>
                  A subdued description sentence sits here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  Card body content. Cards are white on paper, with the rule
                  hairline border and a subtle shadow.
                </p>
              </CardContent>
              <CardFooter>
                <Button size="sm">Action</Button>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Bare card</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">No description, no footer.</p>
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section number="07" label="Badge (shadcn)">
          <Row label="Variants">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="muted">Muted</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </Row>
          <Row label="With dot">
            <Badge variant="muted">
              <StatusDot tone="good" /> Live
            </Badge>
            <Badge variant="muted">
              <StatusDot tone="warn" /> Issue
            </Badge>
            <Badge variant="muted">
              <StatusDot tone="info" /> Info
            </Badge>
            <Badge variant="muted">
              <StatusDot tone="rust" /> Setup
            </Badge>
          </Row>
        </Section>

        <Section number="08" label="Tabs (shadcn)">
          <Row label="Default">
            <Tabs defaultValue="a" className="w-[420px]">
              <TabsList>
                <TabsTrigger value="a">Tab one</TabsTrigger>
                <TabsTrigger value="b">Tab two</TabsTrigger>
                <TabsTrigger value="c">Tab three</TabsTrigger>
              </TabsList>
              <TabsContent value="a">
                <Card>
                  <CardContent>Content A</CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="b">
                <Card>
                  <CardContent>Content B</CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="c">
                <Card>
                  <CardContent>Content C</CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </Row>
          <Row label="Line variant">
            <Tabs defaultValue="a" className="w-[420px]">
              <TabsList variant="line">
                <TabsTrigger value="a">Underline one</TabsTrigger>
                <TabsTrigger value="b">Underline two</TabsTrigger>
                <TabsTrigger value="c">Underline three</TabsTrigger>
              </TabsList>
              <TabsContent value="a">A</TabsContent>
              <TabsContent value="b">B</TabsContent>
              <TabsContent value="c">C</TabsContent>
            </Tabs>
          </Row>
        </Section>

        <Section number="09" label="Tooltip (shadcn)">
          <Row label="Hover targets">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover me (top)</Button>
              </TooltipTrigger>
              <TooltipContent>Helpful info</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover me (right)</Button>
              </TooltipTrigger>
              <TooltipContent side="right">More detail</TooltipContent>
            </Tooltip>
          </Row>
        </Section>

        <Section number="10" label="Eyebrow (Webnua custom)">
          <Row label="Tone: rust">
            <Eyebrow>Audit findings</Eyebrow>
          </Row>
          <Row label="Tone: rust + bullet">
            <Eyebrow bullet>Audit findings</Eyebrow>
          </Row>
          <Row label="Tone: ink">
            <Eyebrow tone="ink" bullet>
              Section heading
            </Eyebrow>
          </Row>
          <Row label="Tone: quiet">
            <Eyebrow tone="quiet" bullet>
              Subdued label
            </Eyebrow>
          </Row>
        </Section>

        <Section number="11" label="StatusDot (Webnua custom)">
          <Row label="Tones">
            <span className="inline-flex items-center gap-2">
              <StatusDot tone="good" /> good
            </span>
            <span className="inline-flex items-center gap-2">
              <StatusDot tone="warn" /> warn
            </span>
            <span className="inline-flex items-center gap-2">
              <StatusDot tone="info" /> info
            </span>
            <span className="inline-flex items-center gap-2">
              <StatusDot tone="rust" /> rust
            </span>
            <span className="inline-flex items-center gap-2">
              <StatusDot tone="quiet" /> quiet
            </span>
          </Row>
        </Section>

        <Section number="12" label="Switch (Webnua custom — bespoke .toggle)">
          <Row label="No label, off">
            <Switch />
          </Row>
          <Row label="No label, on (controlled)">
            <Switch
              checked={switchOn}
              onCheckedChange={setSwitchOn}
            />
          </Row>
          <Row label="With label (controlled)">
            <Switch
              label={labeledSwitch ? 'Enabled' : 'Disabled'}
              checked={labeledSwitch}
              onCheckedChange={setLabeledSwitch}
            />
          </Row>
          <Row label="Disabled">
            <Switch disabled />
            <Switch label="Off, disabled" disabled />
            <Switch label="On, disabled" defaultChecked disabled />
          </Row>
        </Section>

        <footer className="mt-12 border-t border-rule pt-6">
          <p className="font-mono text-[10px] font-bold tracking-[0.12em] text-ink-quiet uppercase">
            End — /primitives-check · delete before final commit
          </p>
        </footer>
      </main>
    </TooltipProvider>
  );
}
