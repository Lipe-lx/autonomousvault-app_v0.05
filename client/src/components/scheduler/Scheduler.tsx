import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarClock, CheckCircle, AlertTriangle, Clock, Trash2, TrendingUp } from 'lucide-react';
import { ScheduledTask } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { StorageService } from '../../services/storageService';

interface SchedulerProps {
    scheduledTasks: ScheduledTask[];
    setScheduledTasks: React.Dispatch<React.SetStateAction<ScheduledTask[]>>;
    addNotification: (msg: string) => void;
}

export const Scheduler: React.FC<SchedulerProps> = ({ scheduledTasks, setScheduledTasks, addNotification }) => {
    const activeTasks = scheduledTasks.filter(t => t.status === 'active' || t.status === 'executing');
    const historyTasks = scheduledTasks.filter(t => t.status === 'completed' || t.status === 'failed')
        .sort((a, b) => (b.lastExecuted || 0) - (a.lastExecuted || 0));

    const handleClearHistory = () => {
        if (window.confirm('Clear all task history?')) {
            setScheduledTasks(prev => {
                const active = prev.filter(t => t.status === 'active' || t.status === 'executing');
                StorageService.setItem(
                    StorageService.getUserKey('agent_scheduled_tasks'),
                    JSON.stringify(active)
                );
                return active;
            });
            addNotification('Task history cleared');
        }
    };

    const handleCancelTask = (taskId: string) => {
        if (window.confirm('Cancel this task?')) {
            setScheduledTasks(prev => {
                const updated = prev.map(t =>
                    t.id === taskId ? { ...t, status: 'failed' as const, result: 'Cancelled by user' } : t
                );
                StorageService.setItem(
                    StorageService.getUserKey('agent_scheduled_tasks'),
                    JSON.stringify(updated)
                );
                return updated;
            });
            addNotification(`Task #${taskId.slice(-4)} cancelled`);
        }
    };

    return (
        <motion.div
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Tasks */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Clock size={20} className="text-emerald-400" /> Active Tasks
                    </h3>
                    <AnimatePresence>
                        {activeTasks.length === 0 ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <Card className="p-8 text-center border-dashed border-2 border-slate-800">
                                    <CalendarClock size={48} className="mx-auto text-slate-700 mb-4" />
                                    <p className="text-slate-500">No active tasks.</p>
                                    <p className="text-xs text-slate-600 mt-2">Ask the AI to "schedule a swap in 10 mins" or "alert me when BTC &gt; 100k"</p>
                                </Card>
                            </motion.div>
                        ) : (
                            activeTasks.map((task, idx) => {
                                const params = JSON.parse(task.params || '{}');

                                // Calculate risk metrics for HL_ORDER
                                let maxProfit = 0, maxLoss = 0, liquidationPrice = 0;
                                if (task.type === 'HL_ORDER' && params.price && params.size) {
                                    const { price, size, leverage = 1, side, takeProfit, stopLoss } = params;
                                    const isLong = side === 'B';
                                    if (takeProfit) maxProfit = (isLong ? takeProfit - price : price - takeProfit) * size;
                                    if (stopLoss) maxLoss = (isLong ? price - stopLoss : stopLoss - price) * size;
                                    const liqPct = (1 / leverage) - 0.005;
                                    liquidationPrice = isLong ? price * (1 - liqPct) : price * (1 + liqPct);
                                }

                                return (
                                    <motion.div
                                        key={task.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ delay: idx * 0.1 }}
                                    >
                                        <Card className="p-5 border-l-4 border-l-emerald-500 relative overflow-hidden">
                                            {task.status === 'executing' && (
                                                <div className="absolute top-2 right-2">
                                                    <span className="relative flex h-3 w-3">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                                                    </span>
                                                </div>
                                            )}

                                            {/* Header */}
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={
                                                        task.type === 'SWAP' ? 'info' :
                                                            task.type === 'TRANSFER' ? 'info' :
                                                                task.type === 'HL_ORDER' ? 'purple' :
                                                                    task.type === 'ALERT' ? 'warning' : 'secondary'
                                                    }>
                                                        {task.type}
                                                    </Badge>
                                                    <span className="text-xs font-mono text-slate-500">#{task.id.slice(-4)}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-slate-400">
                                                        Created: {new Date(task.createdAt).toLocaleTimeString()}
                                                    </span>
                                                    {task.status !== 'executing' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleCancelTask(task.id)}
                                                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                                        >
                                                            <Trash2 size={12} /> Cancel
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Task Details */}
                                            <div className="mb-3 space-y-2">
                                                {task.type === 'SWAP' && (
                                                    <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                                                        <div className="text-xs text-slate-500 mb-1 font-bold uppercase">Swap Details</div>
                                                        <div className="text-sm text-white font-medium">
                                                            {params.amount} {params.inputToken} → {params.outputToken}
                                                        </div>
                                                    </div>
                                                )}

                                                {task.type === 'HL_ORDER' && (
                                                    <>
                                                        <div className="bg-slate-950/50 p-3 rounded-lg border border-purple-900/30 space-y-2">
                                                            <div className="text-xs text-slate-500 mb-2 font-bold uppercase">Hyperliquid Order</div>
                                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                                <div><span className="text-slate-500">Asset:</span><span className="ml-2 text-white font-bold">{params.coin}</span></div>
                                                                <div><span className="text-slate-500">Direction:</span><span className={cn("ml-2 font-bold", params.side === 'B' ? 'text-emerald-400' : 'text-red-400')}>{params.side === 'B' ? 'LONG' : 'SHORT'}</span></div>
                                                                <div><span className="text-slate-500">Size:</span><span className="ml-2 text-white font-medium">{params.size}</span></div>
                                                                <div><span className="text-slate-500">Type:</span><span className="ml-2 text-white font-medium uppercase">{params.orderType}</span></div>
                                                                {params.price && <div><span className="text-slate-500">Price:</span><span className="ml-2 text-white font-medium">${params.price.toLocaleString()}</span></div>}
                                                                <div><span className="text-slate-500">Leverage:</span><span className="ml-2 text-yellow-400 font-bold">{params.leverage}x</span></div>
                                                            </div>
                                                            {(params.stopLoss || params.takeProfit) && (
                                                                <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
                                                                    {params.stopLoss && <div><span className="text-slate-500">Stop Loss:</span><span className="ml-2 text-red-400 font-medium">${params.stopLoss.toLocaleString()}</span></div>}
                                                                    {params.takeProfit && <div><span className="text-slate-500">Take Profit:</span><span className="ml-2 text-emerald-400 font-medium">${params.takeProfit.toLocaleString()}</span></div>}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {params.price && (
                                                            <div className="bg-gradient-to-br from-slate-950/80 to-purple-950/20 p-3 rounded-lg border border-purple-900/40 space-y-2">
                                                                <div className="text-xs text-purple-300 mb-2 font-bold uppercase flex items-center gap-2">
                                                                    <TrendingUp size={12} /> Risk Analysis
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-2 text-xs">
                                                                    {params.takeProfit && (
                                                                        <div className="bg-emerald-900/20 p-2 rounded border border-emerald-800/30">
                                                                            <div className="text-emerald-500 text-[10px] mb-1">MAX PROFIT</div>
                                                                            <div className="text-emerald-400 font-bold">${maxProfit.toFixed(2)}</div>
                                                                        </div>
                                                                    )}
                                                                    {params.stopLoss && (
                                                                        <div className="bg-red-900/20 p-2 rounded border border-red-800/30">
                                                                            <div className="text-red-500 text-[10px] mb-1">MAX LOSS</div>
                                                                            <div className="text-red-400 font-bold">-${maxLoss.toFixed(2)}</div>
                                                                        </div>
                                                                    )}
                                                                    <div className="bg-orange-900/20 p-2 rounded border border-orange-800/30">
                                                                        <div className="text-orange-500 text-[10px] mb-1">LIQUIDATION</div>
                                                                        <div className="text-orange-400 font-bold">${liquidationPrice.toFixed(2)}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>

                                            {/* Trigger Condition */}
                                            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 text-xs">
                                                <div className="flex items-center gap-2 mb-2 text-slate-500 font-bold uppercase tracking-wider">Trigger Condition</div>
                                                {task.condition ? (
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2 text-yellow-400 font-medium">
                                                            <TrendingUp size={14} />
                                                            {task.condition.indicator.toUpperCase()} ({task.condition.symbol}) {task.condition.operator} {task.condition.value}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-emerald-400">
                                                        <Clock size={14} />
                                                        Time: {new Date(task.executeAt!).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    </motion.div>
                                );
                            })
                        )}
                    </AnimatePresence>
                </div>

                {/* Task History */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <CheckCircle size={20} className="text-slate-400" /> History
                        </h3>
                        <Button variant="ghost" size="sm" onClick={handleClearHistory} className="text-slate-500 hover:text-white">
                            <Trash2 size={14} /> Clear History
                        </Button>
                    </div>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                        {historyTasks.length === 0 ? (
                            <div className="text-center py-8 text-slate-600 text-sm">No history available.</div>
                        ) : (
                            historyTasks.map((task, idx) => (
                                <motion.div
                                    key={task.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: idx * 0.05 }}
                                >
                                    <Card className={cn(
                                        "p-4",
                                        task.status === 'completed'
                                            ? 'opacity-70 hover:opacity-100 transition-opacity'
                                            : 'border-red-900/30 bg-red-900/10'
                                    )}>
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-2">
                                                {task.status === 'completed' ? (
                                                    <CheckCircle size={16} className="text-emerald-500" />
                                                ) : (
                                                    <AlertTriangle size={16} className="text-red-500" />
                                                )}
                                                <Badge variant={task.status === 'completed' ? 'success' : 'destructive'}>
                                                    {task.status.toUpperCase()}
                                                </Badge>
                                            </div>
                                            <span className="text-xs text-slate-500">
                                                {task.lastExecuted ? new Date(task.lastExecuted).toLocaleString() : 'Unknown'}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-300 mb-2">
                                            {task.type} - {task.condition ? 'Condition' : 'Time'} Trigger
                                        </div>
                                        <div className="bg-black/30 p-2 rounded text-[10px] font-mono text-slate-400 break-all">
                                            {task.result}
                                        </div>
                                    </Card>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
