import { useEffect, useState } from 'react';
import { assets, type AssetKey } from '@/assets';
import { Screen, ScreenBody, ScreenHeader } from '@/components/layout';
import {
  Button,
  CheckMark,
  EmptyState,
  Field,
  GlassCard,
  Icon,
  IconButton,
  Modal,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  SegmentedTabs,
  Section,
} from '@/components/ui';
import { useAppStore } from '@/store/appStore';
import { useDay, useNutrition, useToday } from '@/store/selectors';
import { mealSlotLabels, mealSlotOrder } from '@/services/defaults';
import { PILLAR_TAGLINES } from '@/domain/pillars';
import { formatNumber, safeNumber } from '@/utils/format';
import { formatTime12h } from '@/utils/date';
import type { Meal, MealSlot } from '@/models';
import './screens.css';

type Tab = 'meals' | 'nutrition';

export function DietScreen() {
  const today = useToday();
  const day = useDay(today);
  const goals = useAppStore((s) => s.goals);
  const settings = useAppStore((s) => s.settings);
  const ensureMeals = useAppStore((s) => s.ensureMeals);
  const toggleMeal = useAppStore((s) => s.toggleMeal);
  const addMeal = useAppStore((s) => s.addMeal);
  const updateMeal = useAppStore((s) => s.updateMeal);
  const removeMeal = useAppStore((s) => s.removeMeal);
  const pushToast = useAppStore((s) => s.pushToast);

  const { consumed, planned } = useNutrition(today);
  const [tab, setTab] = useState<Tab>('meals');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    ensureMeals(today);
  }, [ensureMeals, today]);

  const meals = [...day.meals].sort(
    (a, b) => mealSlotOrder.indexOf(a.slot) - mealSlotOrder.indexOf(b.slot) || a.time.localeCompare(b.time),
  );
  const completedCount = meals.filter((m) => m.completed).length;
  const editing = meals.find((m) => m.id === editingId) ?? null;

  return (
    <Screen scrollKey="diet">
      <ScreenHeader
        title="Nutrition"
        subtitle={PILLAR_TAGLINES.diet}
        actions={<IconButton icon="plus" label="Add meal" bordered onClick={() => setAddOpen(true)} />}
      />

      <ScreenBody>
        <SegmentedTabs
          items={[
            { value: 'meals', label: 'Meals' },
            { value: 'nutrition', label: 'Nutrition' },
          ]}
          value={tab}
          onChange={setTab}
          label="Nutrition view"
        />

        {tab === 'meals' ? (
          <div style={{ marginTop: 'var(--sp-4)', display: 'grid', gap: 'var(--sp-4)' }}>
            {meals.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                showMacros={settings.widgets.showMacros}
                onToggle={() => toggleMeal(today, meal.id)}
                onEdit={() => setEditingId(meal.id)}
                onRemove={() => {
                  if (window.confirm(`Remove ${meal.title}?`)) removeMeal(today, meal.id);
                }}
              />
            ))}

            {meals.length === 0 ? (
              <EmptyState
                icon="bowl"
                title="No meals planned"
                description="Add the meals you intend to eat today, then tick them off as you go."
                action={
                  <PrimaryButton style={{ marginTop: 'var(--sp-3)' }} onClick={() => setAddOpen(true)}>
                    Add a meal
                  </PrimaryButton>
                }
              />
            ) : null}

            <GlassCard variant="soft">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)' }}>
                  Diet pillar progress
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {completedCount}/{goals.mealsPerDay}
                </span>
              </div>
              <div style={{ marginTop: 'var(--sp-3)' }}>
                <ProgressBar
                  value={goals.mealsPerDay ? completedCount / goals.mealsPerDay : 0}
                  label="Meals completed"
                  size="sm"
                />
              </div>
            </GlassCard>
          </div>
        ) : (
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <GlassCard>
              <h2 className="section__title" style={{ marginBottom: 'var(--sp-4)' }}>
                Eaten today
              </h2>
              <div className="nutri-goal">
                <GoalRow
                  label="Calories"
                  value={consumed.calories}
                  target={goals.calorieTarget}
                  unit="kcal"
                />
                <GoalRow label="Protein" value={consumed.protein} target={goals.proteinTarget} unit="g" />
                <GoalRow label="Carbs" value={consumed.carbs} target={Math.round(goals.calorieTarget * 0.45 / 4)} unit="g" />
                <GoalRow label="Fats" value={consumed.fats} target={Math.round(goals.calorieTarget * 0.28 / 9)} unit="g" />
              </div>
            </GlassCard>

            <Section title="Planned total" meta={`${formatNumber(planned.calories)} kcal`}>
              <GlassCard variant="soft">
                <div className="macro-row" style={{ margin: 0 }}>
                  <Macro value={`${formatNumber(planned.calories)}`} label="Calories" />
                  <Macro value={`${formatNumber(planned.protein)}g`} label="Protein" />
                  <Macro value={`${formatNumber(planned.carbs)}g`} label="Carbs" />
                  <Macro value={`${formatNumber(planned.fats)}g`} label="Fats" />
                </div>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: 'var(--sp-4)', lineHeight: 1.5 }}>
                  Planned totals include every meal on today&rsquo;s list. The figures above count only
                  the meals you have marked as eaten.
                </p>
              </GlassCard>
            </Section>

            <Section title="Targets">
              <GlassCard variant="soft">
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Calorie and protein targets are set in Settings under Goals and Preferences. Carb and
                  fat targets are derived from your calorie target.
                </p>
              </GlassCard>
            </Section>
          </div>
        )}
      </ScreenBody>

      <MealEditor
        meal={editing}
        open={editing !== null}
        onClose={() => setEditingId(null)}
        onSave={(patch) => {
          if (!editing) return;
          updateMeal(today, editing.id, patch);
          setEditingId(null);
          pushToast('Meal updated.', 'success');
        }}
      />

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a meal"
        description="Choose which slot it belongs to."
      >
        <div style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          {mealSlotOrder.map((slot) => (
            <SecondaryButton
              key={slot}
              block
              onClick={() => {
                const id = addMeal(today, slot);
                setAddOpen(false);
                setEditingId(id);
              }}
            >
              {mealSlotLabels[slot]}
            </SecondaryButton>
          ))}
        </div>
      </Modal>
    </Screen>
  );
}

/* ---------------------------------------------------------------- Parts */

function Macro({ value, label }: { value: string; label: string }) {
  return (
    <div className="macro">
      <div className="macro__value">{value}</div>
      <div className="macro__label">{label}</div>
    </div>
  );
}

function GoalRow({
  label,
  value,
  target,
  unit,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
}) {
  return (
    <div className="nutri-goal__row">
      <div className="nutri-goal__head">
        <span>{label}</span>
        <span className="nutri-goal__value">
          {formatNumber(value)} / {formatNumber(target)} {unit}
        </span>
      </div>
      <ProgressBar value={target ? value / target : 0} size="sm" label={`${label} progress`} />
    </div>
  );
}

function MealCard({
  meal,
  showMacros,
  onToggle,
  onEdit,
  onRemove,
}: {
  meal: Meal;
  showMacros: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const art = meal.asset && meal.asset in assets ? assets[meal.asset as AssetKey] : null;

  return (
    <GlassCard pad={false} className="meal">
      <div className="meal__head">
        <button
          type="button"
          className="hit"
          style={{ marginLeft: -10 }}
          onClick={onToggle}
          aria-pressed={meal.completed}
          aria-label={`Mark ${meal.title} ${meal.completed ? 'not eaten' : 'eaten'}`}
        >
          <CheckMark on={meal.completed} small />
        </button>
        <h3 className="meal__title">{meal.title}</h3>
        <span className="meal__time">{formatTime12h(meal.time)}</span>
        <CheckMark on={meal.completed} />
      </div>

      {art ? (
        <div className="meal__img">
          <img src={art.src} alt="" aria-hidden="true" loading="lazy" decoding="async" style={{ objectPosition: art.position }} />
        </div>
      ) : null}

      {meal.items ? <p className="meal__items">{meal.items}</p> : null}
      {meal.note ? <p className="meal__note">{meal.note}</p> : null}

      {showMacros ? (
        <div className="macro-row">
          <Macro value={formatNumber(meal.nutrition.calories)} label="Calories" />
          <Macro value={`${formatNumber(meal.nutrition.protein)}g`} label="Protein" />
          <Macro value={`${formatNumber(meal.nutrition.carbs)}g`} label="Carbs" />
          <Macro value={`${formatNumber(meal.nutrition.fats)}g`} label="Fats" />
        </div>
      ) : (
        <p className="meal__note" style={{ paddingBottom: 'var(--sp-3)' }}>
          {formatNumber(meal.nutrition.calories)} kcal
        </p>
      )}

      <div className="meal__actions">
        <Button variant="ghost" size="sm" iconLeft="edit" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="ghost" size="sm" iconLeft="trash" onClick={onRemove}>
          Remove
        </Button>
        <span style={{ flex: 1 }} />
        <Button variant="ghost" size="sm" onClick={onToggle}>
          {meal.completed ? 'Undo' : 'Mark eaten'}
        </Button>
      </div>
    </GlassCard>
  );
}

function MealEditor({
  meal,
  open,
  onClose,
  onSave,
}: {
  meal: Meal | null;
  open: boolean;
  onClose: () => void;
  onSave: (patch: Partial<Meal> & { nutrition?: Partial<Meal['nutrition']> }) => void;
}) {
  const [title, setTitle] = useState('');
  const [items, setItems] = useState('');
  const [note, setNote] = useState('');
  const [time, setTime] = useState('12:00');
  const [calories, setCalories] = useState('0');
  const [protein, setProtein] = useState('0');
  const [carbs, setCarbs] = useState('0');
  const [fats, setFats] = useState('0');
  const [slot, setSlot] = useState<MealSlot>('breakfast');

  useEffect(() => {
    if (!meal) return;
    setTitle(meal.title);
    setItems(meal.items);
    setNote(meal.note);
    setTime(meal.time);
    setCalories(String(meal.nutrition.calories));
    setProtein(String(meal.nutrition.protein));
    setCarbs(String(meal.nutrition.carbs));
    setFats(String(meal.nutrition.fats));
    setSlot(meal.slot);
  }, [meal]);

  if (!meal) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit meal"
      description="Name it, log the macros, and set the time."
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton
            onClick={() =>
              onSave({
                title: title.trim() || mealSlotLabels[slot],
                items: items.trim(),
                note: note.trim(),
                time,
                slot,
                nutrition: {
                  calories: safeNumber(calories),
                  protein: safeNumber(protein),
                  carbs: safeNumber(carbs),
                  fats: safeNumber(fats),
                },
              })
            }
          >
            Save
          </PrimaryButton>
        </>
      }
    >
      <Field label="Meal name" value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} />
      <Field
        label="What's in it"
        placeholder="e.g. Oats, berries, banana"
        value={items}
        maxLength={120}
        onChange={(e) => setItems(e.target.value)}
      />
      <Field
        label="Note"
        placeholder="e.g. High protein, clean carbs"
        value={note}
        maxLength={80}
        onChange={(e) => setNote(e.target.value)}
      />
      <Field label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />

      <div className="field-row">
        <Field
          label="Calories"
          type="number"
          inputMode="numeric"
          min={0}
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
        />
        <Field
          label="Protein (g)"
          type="number"
          inputMode="numeric"
          min={0}
          value={protein}
          onChange={(e) => setProtein(e.target.value)}
        />
      </div>
      <div className="field-row">
        <Field
          label="Carbs (g)"
          type="number"
          inputMode="numeric"
          min={0}
          value={carbs}
          onChange={(e) => setCarbs(e.target.value)}
        />
        <Field
          label="Fats (g)"
          type="number"
          inputMode="numeric"
          min={0}
          value={fats}
          onChange={(e) => setFats(e.target.value)}
        />
      </div>

      <div className="field">
        <span className="field__label">Slot</span>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {mealSlotOrder.map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              aria-pressed={slot === s}
              style={
                slot === s
                  ? { borderColor: 'var(--glass-border-strong)', color: 'var(--accent-ice)', minHeight: 40 }
                  : { minHeight: 40 }
              }
              onClick={() => setSlot(s)}
            >
              {slot === s ? <Icon name="check" size={13} /> : null}
              {mealSlotLabels[s]}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
