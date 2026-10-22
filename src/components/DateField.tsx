import type { ChangeEvent } from 'react';
import { formatDateNumeric, useDateFormat } from '../lib/dateFormat';

interface Props {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  min?: string;
  max?: string;
  id?: string;
  className?: string;
  'aria-label'?: string;
  placeholder?: string;
}

/**
 * A date box that writes its date in the order chosen in Settings (the phone's own date input always uses the
 * phone's language). A real date input sits invisibly on top, so tapping still opens the phone's date picker.
 */
export default function DateField({ value, onChange, min, max, id, className = '', placeholder = 'Select date', ...rest }: Props) {
  const order = useDateFormat();
  return (
    <div className={`relative flex items-center text-left focus-within:border-primary ${className}`}>
      <span className={`truncate pointer-events-none ${value ? '' : 'text-content-muted'}`}>
        {value ? formatDateNumeric(value, order) : placeholder}
      </span>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={onChange}
        aria-label={rest['aria-label']}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
}
