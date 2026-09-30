import type { Settings } from '@/models';
import { parseTimeToMinutes } from '@/utils/date';

export interface Reminder {
  id: string;
  message: string;
  icon: 'alert' | 'flame' | 'flag' | 'clock';
}

export interface ReminderInput {
  settings: Settings;
  /** Pillars secured today, out of four. */
  completed: number;
  totalPillars: number;
  currentStreak: number;
  isMilestoneDay: boolean;
  milestoneDay: number | null;
  /** Minutes past midnight, local. */
  nowMinutes: number;
}

/**
 * Winter Arc runs entirely on the device, so it cannot push a notification.
 * The notification preferences instead drive in-app reminders, which keeps
 * every switch in Settings connected to something the user can see.
 */
export function buildReminders(input: ReminderInput): Reminder[] {
  const { settings, completed, totalPillars, currentStreak, isMilestoneDay, milestoneDay, nowMinutes } = input;
  const n = settings.notifications;
  if (!n.enabled) return [];

  const out: Reminder[] = [];
  const secured = completed >= totalPillars;

  if (n.milestoneAlerts && isMilestoneDay && milestoneDay !== null) {
    out.push({
      id: 'milestone',
      icon: 'flag',
      message: secured
        ? `Day ${milestoneDay} secured. Milestone bonus earned.`
        : `Day ${milestoneDay} is a milestone. Secure all four pillars for a bonus.`,
    });
  }

  if (n.streakAlerts && !secured && currentStreak > 0) {
    out.push({
      id: 'streak',
      icon: 'flame',
      message: `Your ${currentStreak} day streak is on the line. ${totalPillars - completed} ${
        totalPillars - completed === 1 ? 'pillar' : 'pillars'
      } left.`,
    });
  }

  if (n.dailyReminder && !secured) {
    const at = parseTimeToMinutes(n.reminderTime);
    if (at !== null && nowMinutes >= at) {
      out.push({
        id: 'daily',
        icon: 'clock',
        message:
          completed === 0
            ? 'Nothing secured yet today. Start with one pillar.'
            : `${completed} of ${totalPillars} secured. Keep going.`,
      });
    }
  }

  return out;
}
