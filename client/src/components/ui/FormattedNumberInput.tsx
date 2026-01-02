import React, { useState, useEffect } from 'react';

interface FormattedNumberInputProps {
    value: number;
    onChange: (value: number) => void;
    className?: string;
}

export const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({ value, onChange, className }) => {
    const isCommaDecimal = (1.1).toLocaleString().includes(',');
    const [str, setStr] = useState(value != null ? value.toLocaleString() : '');
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused && value != null) {
            setStr(value.toLocaleString());
        }
    }, [value, isFocused]);

    const handleFocus = () => {
        setIsFocused(true);
        if (value != null) {
            // Show un-grouped number with local decimal separator
            setStr(value.toLocaleString(undefined, { useGrouping: false, maximumFractionDigits: 20 }));
        }
    };

    const handleBlur = () => {
        setIsFocused(false);
        let clean = str;
        if (isCommaDecimal) {
            // Remove dots (thousands), replace comma with dot
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else {
            // Remove commas (thousands)
            clean = clean.replace(/,/g, '');
        }

        const num = parseFloat(clean);
        if (!isNaN(num)) {
            onChange(num);
            setStr(num.toLocaleString());
        } else if (value != null) {
            setStr(value.toLocaleString());
        }
    };

    return (
        <input
            type="text"
            className={className}
            value={str}
            onChange={(e) => setStr(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.currentTarget.blur();
                }
            }}
        />
    );
};
