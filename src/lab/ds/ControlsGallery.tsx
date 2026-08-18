import type { ReactNode } from 'react';
import { useState } from 'react';
import { Avatar } from '@/ds/avatar';
import { Badge } from '@/ds/badge';
import { Checkbox } from '@/ds/checkbox';
import { Field } from '@/ds/field';
import {
	IconCircle,
	IconCircleCheck,
	IconCircleHalf,
	IconCircleSlash,
	IconClose,
	IconSearch,
} from '@/ds/icons';
import { Input } from '@/ds/input';
import { Kbd } from '@/ds/kbd';
import { Page } from '@/ds/page';
import { ScrollArea } from '@/ds/scroll-area';
import { Select } from '@/ds/select';
import { Separator } from '@/ds/separator';
import { Switch } from '@/ds/switch';
import { Tabs } from '@/ds/tabs';
import { Textarea } from '@/ds/textarea';
import styles from './ControlsGallery.module.css';

const STATUS_ITEMS = [
	{ value: 'backlog', label: 'Backlog', icon: <IconCircle size={14} /> },
	{ value: 'in-progress', label: 'In progress', icon: <IconCircleHalf size={14} /> },
	{ value: 'done', label: 'Done', icon: <IconCircleCheck size={14} /> },
	{ value: 'wont-fix', label: "Won't fix", icon: <IconCircleSlash size={14} />, disabled: true },
];

const PLAIN_ITEMS = [
	{ value: 'low', label: 'Low' },
	{ value: 'medium', label: 'Medium' },
	{ value: 'high', label: 'High' },
	{ value: 'urgent', label: 'Urgent' },
];

const PEOPLE = ['Ada Lovelace', 'Grace Hopper', '田中 太郎', 'Barbara Liskov', 'Zeynep Öz'];

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<Page.Subsection>
			<Page.SubsectionTitle>{title}</Page.SubsectionTitle>
			{children}
		</Page.Subsection>
	);
}

function Demo({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className={styles.demo}>
			<span className={styles.caption}>{label}</span>
			<div className={styles.demoBody}>{children}</div>
		</div>
	);
}

export function ControlsGallery() {
	const [status, setStatus] = useState<string | null>('in-progress');
	const [notify, setNotify] = useState(true);
	const [selected, setSelected] = useState(false);

	return (
		<Page.Section>
			<Page.SectionTitle>Controls</Page.SectionTitle>
			<Page.Description>
				Every form control and layout primitive in <code>src/ds</code>, in each state it ships with.
				Check it at 360px and in both themes.
			</Page.Description>

			<Section title="Input">
				<div className={styles.grid}>
					<Demo label="default">
						<Input placeholder="Search issues…" />
					</Demo>
					<Demo label="size=sm">
						<Input size="sm" placeholder="Small" />
					</Demo>
					<Demo label="leading icon">
						<Input leadingIcon={<IconSearch size={16} />} placeholder="Search issues…" />
					</Demo>
					<Demo label="trailing slot">
						<Input
							leadingIcon={<IconSearch size={16} />}
							trailing={<Kbd>⌘K</Kbd>}
							placeholder="Jump to…"
						/>
					</Demo>
					<Demo label="trailing button">
						<Input
							defaultValue="crash on paste"
							trailing={
								<button type="button" className={styles.iconButton} aria-label="Clear">
									<IconClose size={14} />
								</button>
							}
						/>
					</Demo>
					<Demo label="disabled">
						<Input disabled defaultValue="Read only" />
					</Demo>
					<Demo label="invalid (standalone)">
						<Input aria-invalid="true" defaultValue="not-an-email" />
					</Demo>
					<Demo label="filled">
						<Input defaultValue="Repro: open picker, type ク" />
					</Demo>
				</div>
			</Section>

			<Section title="Textarea">
				<div className={styles.grid}>
					<Demo label="default (minRows=3)">
						<Textarea placeholder="Describe the bug…" />
					</Demo>
					<Demo label="minRows=2">
						<Textarea minRows={2} placeholder="Two rows to start" />
					</Demo>
					<Demo label="autoResize, maxRows=6">
						<Textarea
							autoResize
							maxRows={6}
							minRows={2}
							defaultValue={'Grows with the content.\nAdd lines and watch.'}
						/>
					</Demo>
					<Demo label="disabled">
						<Textarea disabled defaultValue="Locked while the mutation is in flight." />
					</Demo>
				</div>
			</Section>

			<Section title="Field">
				<div className={styles.grid}>
					<Demo label="label + description">
						<Field label="Title" description="One line. Keep it searchable.">
							<Input placeholder="Combobox drops rows on fast scroll" />
						</Field>
					</Demo>
					<Demo label="error">
						<Field label="Title" error="A title is required.">
							<Input placeholder="Combobox drops rows on fast scroll" />
						</Field>
					</Demo>
					<Demo label="disabled">
						<Field label="Reporter" description="Set from your session." disabled>
							<Input defaultValue="michal" />
						</Field>
					</Demo>
					<Demo label="around a Textarea">
						<Field label="Steps to reproduce" description="Numbered, one action per line.">
							<Textarea minRows={3} placeholder="1. Open the assignee picker" />
						</Field>
					</Demo>
					<Demo label="around a Select (nativeLabel=false)">
						<Field label="Priority" nativeLabel={false} description="Drives sort order.">
							<Select items={PLAIN_ITEMS} placeholder="Choose a priority" />
						</Field>
					</Demo>
					{/* The checkbox carries its own label here, so the Field supplies only
					    description and error — two labels on one control would be worse. */}
					<Demo label="around a Checkbox">
						<Field description="Applies to issues you follow." error="Pick at least one channel.">
							<Checkbox label="Email me on every comment" />
						</Field>
					</Demo>
				</div>
			</Section>

			<Section title="Checkbox">
				<div className={styles.row}>
					<Checkbox label="Unchecked" />
					<Checkbox label="Checked" defaultChecked />
					<Checkbox label="Indeterminate" indeterminate />
					<Checkbox label="Disabled" disabled />
					<Checkbox label="Disabled + checked" disabled defaultChecked />
					<Checkbox
						label="Controlled"
						checked={selected}
						onCheckedChange={(next) => setSelected(next)}
					/>
					<Checkbox aria-label="No label" />
				</div>
			</Section>

			<Section title="Switch">
				<div className={styles.row}>
					<Switch label="Off" />
					<Switch label="On" defaultChecked />
					<Switch label="Disabled" disabled />
					<Switch label="Disabled + on" disabled defaultChecked />
					<Switch
						label="Instrumentation"
						checked={notify}
						onCheckedChange={(next) => setNotify(next)}
					/>
					<Switch aria-label="No label" />
				</div>
			</Section>

			<Section title="Select">
				<div className={styles.grid}>
					<Demo label="placeholder">
						<Select items={PLAIN_ITEMS} placeholder="Choose a priority" />
					</Demo>
					<Demo label="icons + a disabled item">
						<Select items={STATUS_ITEMS} value={status} onValueChange={(next) => setStatus(next)} />
					</Demo>
					<Demo label="size=sm">
						<Select size="sm" items={PLAIN_ITEMS} defaultValue="high" />
					</Demo>
					<Demo label="disabled">
						<Select items={PLAIN_ITEMS} defaultValue="low" disabled />
					</Demo>
					<Demo label="long labels truncate">
						<Select
							items={[
								{ value: 'a', label: 'Assignee picker regression on momentum scroll (iOS)' },
								{ value: 'b', label: 'Short' },
							]}
							defaultValue="a"
						/>
					</Demo>
				</div>
			</Section>

			<Section title="Tabs">
				<Tabs defaultValue="overview">
					<Tabs.List>
						<Tabs.Tab value="overview">Overview</Tabs.Tab>
						<Tabs.Tab value="activity">Activity</Tabs.Tab>
						<Tabs.Tab value="attachments">Attachments</Tabs.Tab>
						<Tabs.Tab value="audit" disabled>
							Audit
						</Tabs.Tab>
					</Tabs.List>
					<Tabs.Panel value="overview">Status, priority, assignee.</Tabs.Panel>
					<Tabs.Panel value="activity">Comments and state changes.</Tabs.Panel>
					<Tabs.Panel value="attachments">Screenshots and traces.</Tabs.Panel>
					<Tabs.Panel value="audit">Not available on this plan.</Tabs.Panel>
				</Tabs>
			</Section>

			<Section title="Avatar">
				<div className={styles.row}>
					<Avatar name="Ada Lovelace" size="sm" />
					<Avatar name="Ada Lovelace" size="md" />
					<Avatar name="Ada Lovelace" size="lg" />
					<Separator orientation="vertical" />
					{PEOPLE.map((person) => (
						<Avatar key={person} name={person} />
					))}
					<Separator orientation="vertical" />
					<Avatar name="Fixed hue" hue={140} initials="FH" />
					<Avatar name="Fixed hue" hue={280} initials="FH" />
				</div>
			</Section>

			<Section title="Badge">
				<div className={styles.row}>
					<Badge>Backlog</Badge>
					<Badge variant="info">In progress</Badge>
					<Badge variant="success">Done</Badge>
					<Badge variant="warning">Needs info</Badge>
					<Badge variant="danger">Regression</Badge>
				</div>
			</Section>

			<Section title="Separator">
				<div className={styles.stack}>
					<Demo label="horizontal">
						<Separator />
					</Demo>
					<Demo label="vertical">
						<div className={styles.row}>
							<span>Opened 3d ago</span>
							<Separator orientation="vertical" />
							<span>4 comments</span>
							<Separator orientation="vertical" />
							<span>2 linked</span>
						</div>
					</Demo>
				</div>
			</Section>

			<Section title="Kbd">
				<div className={styles.row}>
					<Kbd>⌘K</Kbd>
					<Kbd>⇧⌘P</Kbd>
					<Kbd>Esc</Kbd>
					<Kbd>↑</Kbd>
					<Kbd>↓</Kbd>
				</div>
			</Section>

			<Section title="ScrollArea">
				<div className={styles.grid}>
					<Demo label="vertical">
						<ScrollArea className={styles.scroller}>
							<div className={styles.scrollBody}>
								{Array.from({ length: 24 }, (_, index) => (
									<div key={index} className={styles.scrollRow}>
										<Avatar name={PEOPLE[index % PEOPLE.length]!} size="sm" decorative />
										<span>Row {index + 1}</span>
										<Badge variant={index % 3 === 0 ? 'warning' : 'neutral'}>
											{index % 3 === 0 ? 'Needs info' : 'Backlog'}
										</Badge>
									</div>
								))}
							</div>
						</ScrollArea>
					</Demo>
					<Demo label="both axes">
						<ScrollArea orientation="both" className={styles.scroller}>
							<div className={styles.wideBody}>
								{Array.from({ length: 12 }, (_, index) => (
									<div key={index} className={styles.wideRow}>
										Row {index + 1} — a deliberately long line that forces horizontal overflow so
										the corner and both scrollbars are visible.
									</div>
								))}
							</div>
						</ScrollArea>
					</Demo>
				</div>
			</Section>
		</Page.Section>
	);
}
