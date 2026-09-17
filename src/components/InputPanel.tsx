import { COVERAGE_TIERS, MAX_AGE, MIN_AGE, REGIONS, RIDERS } from '../domain/data';
import type { CalculatorInput, CoverageCode, RegionCode, RiderId } from '../domain/types';

interface InputPanelProps {
  input: CalculatorInput;
  onChange: (next: CalculatorInput, coalesceKey?: string) => void;
}

const RIDER_HINTS: Record<RiderId, string | null> = {
  'rider-accident-medical': '与「综合意外升级包」互斥',
  'rider-accident-hospital': null,
  'rider-traffic-double': '与「综合意外升级包」互斥',
  'rider-full-accident': '与「意外医疗」「交通加倍」互斥 · 仅标准版/旗舰版可附加',
};

export default function InputPanel({ input, onChange }: InputPanelProps) {
  const ageInvalid = input.age !== null && (input.age < MIN_AGE || input.age > MAX_AGE);

  const toggleRider = (id: RiderId) => {
    const riders = input.riders.includes(id)
      ? input.riders.filter((rider) => rider !== id)
      : [...input.riders, id];
    onChange({ ...input, riders });
  };

  return (
    <div className="panel">
      <h2>投保条件</h2>

      <div className="field">
        <label htmlFor="age">
          年龄（{MIN_AGE}–{MAX_AGE} 周岁）
        </label>
        <input
          id="age"
          type="number"
          min={MIN_AGE}
          max={MAX_AGE}
          placeholder="请输入年龄"
          value={input.age ?? ''}
          onChange={(event) =>
            onChange(
              { ...input, age: event.target.value === '' ? null : Number(event.target.value) },
              'age',
            )
          }
        />
        {ageInvalid && (
          <p className="field-error">
            年龄需在 {MIN_AGE}–{MAX_AGE} 周岁之间，当前无法承保
          </p>
        )}
        {input.age === null && <p className="field-hint">未填写 · 年龄费率暂无法计算</p>}
      </div>

      <div className="field">
        <label htmlFor="region">投保地区</label>
        <select
          id="region"
          value={input.region ?? ''}
          onChange={(event) =>
            onChange({
              ...input,
              region: event.target.value === '' ? null : (event.target.value as RegionCode),
            })
          }
        >
          <option value="">请选择地区</option>
          {REGIONS.map((region) => (
            <option key={region.code} value={region.code}>
              {region.label}（×{region.factor}）
            </option>
          ))}
        </select>
        {input.region === null && <p className="field-hint">未选择 · 地区系数暂无法计算</p>}
      </div>

      <div className="field">
        <label htmlFor="coverage">保障额度</label>
        <select
          id="coverage"
          value={input.coverage ?? ''}
          onChange={(event) =>
            onChange({
              ...input,
              coverage: event.target.value === '' ? null : (event.target.value as CoverageCode),
            })
          }
        >
          <option value="">请选择保障额度</option>
          {COVERAGE_TIERS.map((tier) => (
            <option key={tier.code} value={tier.code}>
              {tier.label}（档位系数 ×{tier.factor}）
            </option>
          ))}
        </select>
        {input.coverage === null && <p className="field-hint">未选择 · 保额档位与高保额优惠暂无法计算</p>}
      </div>

      <fieldset className="field riders">
        <legend>附加险（可多选，部分互斥）</legend>
        {RIDERS.map((rider) => {
          const hint = RIDER_HINTS[rider.id];
          return (
            <label key={rider.id} className="rider-item">
              <input
                type="checkbox"
                checked={input.riders.includes(rider.id)}
                onChange={() => toggleRider(rider.id)}
              />
              <span className="rider-main">
                <span className="rider-name">{rider.name}</span>
                {hint && <span className="rider-hint">{hint}</span>}
              </span>
              <span className="rider-price">+¥{rider.price}/年</span>
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}
