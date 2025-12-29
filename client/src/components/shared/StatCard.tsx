import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '../ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
    title: string;
    value: string;
    subtext?: string;
    highlight?: boolean;
    icon?: React.ReactNode;
    trend?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    subtext,
    highlight = false,
    icon,
    trend
}) => (
    <motion.div
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
        <Card className={cn(
            "relative overflow-hidden group",
            highlight && "border-emerald-500/30 bg-emerald-900/10"
        )}>
            <CardContent className="p-6">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    {icon}
                </div>
                <h3 className="text-slate-400 text-sm font-medium mb-2 flex items-center gap-2">
                    {title}
                </h3>
                <div className="flex items-baseline gap-2">
                    <div className="text-3xl font-bold text-white">{value}</div>
                    {trend && (
                        <motion.div
                            className={cn(
                                "text-sm font-medium",
                                trend.startsWith('+') ? 'text-emerald-400' :
                                    trend.startsWith('-') ? 'text-rose-400' :
                                        'text-slate-400'
                            )}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            {trend}
                        </motion.div>
                    )}
                </div>
                {subtext && (
                    <div className={cn(
                        "text-xs mt-1",
                        highlight ? 'text-emerald-400' : 'text-slate-500'
                    )}>
                        {subtext}
                    </div>
                )}
            </CardContent>
        </Card>
    </motion.div>
);
