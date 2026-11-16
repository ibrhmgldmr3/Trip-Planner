"use client";

import type { ReactNode } from "react";

export interface ChipOption {
  value: string;
  label?: string;
  icon?: ReactNode;
}

interface BaseProps {
  label: string;
  hint?: string;
  options: ChipOption[];
}

interface SingleProps extends BaseProps {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
}

interface MultiProps extends BaseProps {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
}

/** Tekli (radyo) veya çoklu (onay) seçim için çip grubu. */
export default function ChipGroup(props: SingleProps | MultiProps) {
  const { label, hint, options } = props;

  const isOn = (option: string) =>
    props.multiple ? props.value.includes(option) : props.value === option;

  const toggle = (option: string) => {
    if (props.multiple) {
      props.onChange(
        props.value.includes(option) ? props.value.filter((item) => item !== option) : [...props.value, option]
      );
    } else {
      props.onChange(option);
    }
  };

  return (
    <fieldset>
      <legend className="field-label">{label}</legend>
      <div className="flex flex-wrap gap-2" role={props.multiple ? "group" : "radiogroup"} aria-label={label}>
        {options.map((option) => {
          const on = isOn(option.value);
          return (
            <button
              key={option.value}
              type="button"
              className="chip"
              onClick={() => toggle(option.value)}
              {...(props.multiple
                ? { "aria-pressed": on }
                : { role: "radio" as const, "aria-checked": on })}
            >
              {option.icon}
              {option.label ?? option.value}
            </button>
          );
        })}
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </fieldset>
  );
}
