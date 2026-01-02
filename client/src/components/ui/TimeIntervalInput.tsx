import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { FormattedNumberInput } from './FormattedNumberInput';

interface TimeIntervalInputProps {
    value: number; // Value in seconds
    onChange: (newValue: number) => void;
}

type TimeUnit = 'M' | 'H' | 'D' | 'W';

const UNIT_MULTIPLIERS: Record<TimeUnit, number> = {
    'M': 60,
    'H': 3600,
    'D': 86400,
    'W': 604800
};

const UNIT_LABELS: Record<TimeUnit, string> = {
    'M': 'Minutes',
    'H': 'Hours',
    'D': 'Days',
    'W': 'Weeks'
};

const UNIT_STEP: Record<TimeUnit, number> = {
    'M': 1,
    'H': 1,
    'D': 1,
    'W': 1
};

export const TimeIntervalInput: React.FC<TimeIntervalInputProps> = ({
    value,
    onChange
}) => {
    const [unit, setUnit] = useState<TimeUnit>('M');
    
    const multiplier = UNIT_MULTIPLIERS[unit];
    const displayValue = value / multiplier;
    const step = UNIT_STEP[unit];

    const handleNumberChange = (newNum: number) => {
        onChange(newNum * multiplier);
    };

    const handleUnitChange = (newUnit: TimeUnit) => {
        setUnit(newUnit);
        onChange(displayValue * UNIT_MULTIPLIERS[newUnit]);
    };

    const handleIncrement = () => {
        handleNumberChange(displayValue + step);
    };

    const handleDecrement = () => {
        handleNumberChange(Math.max(1, displayValue - step));
    };

    return (
        <div className="flex items-center justify-between">
            {/* Left: Number input */}
            <FormattedNumberInput
                className="text-sm font-bold font-mono text-white bg-transparent outline-none w-10"
                value={displayValue}
                onChange={handleNumberChange}
            />
            
            {/* Center: +/- buttons */}
            <div className="flex flex-col gap-0.5">
                <button 
                    onClick={handleIncrement} 
                    className="p-0.5 rounded bg-[#232328] hover:bg-[#303036] text-[#E7FE55] transition-colors"
                >
                    <Plus size={8} />
                </button>
                <button 
                    onClick={handleDecrement} 
                    className="p-0.5 rounded bg-[#232328] hover:bg-[#303036] text-[#747580] hover:text-white transition-colors"
                >
                    <Minus size={8} />
                </button>
            </div>
            
            {/* Right: Unit selector */}
            <select
                value={unit}
                onChange={(e) => handleUnitChange(e.target.value as TimeUnit)}
                className="bg-transparent text-[10px] text-[#747580] font-medium uppercase tracking-wider border-none focus:outline-none cursor-pointer hover:text-white transition-colors appearance-none pr-3"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%23747580' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right center',
                }}
            >
                <option value="M" className="bg-[#0f1015]">{UNIT_LABELS['M']}</option>
                <option value="H" className="bg-[#0f1015]">{UNIT_LABELS['H']}</option>
                <option value="D" className="bg-[#0f1015]">{UNIT_LABELS['D']}</option>
                <option value="W" className="bg-[#0f1015]">{UNIT_LABELS['W']}</option>
            </select>
        </div>
    );
};
