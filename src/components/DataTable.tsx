'use client';

import React, { useState, useEffect } from 'react';
import { Table, Select, Space, Card, Button } from 'antd';
import type { TableProps } from 'antd';

const { Option } = Select;

const GROUP_OPTIONS = [
    'geo', 'app_id', 'os', 'publisher', 'bundle'
];

interface DataTableProps {
    onFetch: (params: any) => Promise<any>;
    filterParams: any;
}

// Metrics to aggregate
const METRIC_FIELDS = ['clicks', 'installs', 'events', 'revenues'];

// Helper to calculate rates
const calculateRates = (node: any) => {
    const clicks = node.clicks || 0;
    node.cvr = clicks > 0 ? Number(((node.installs / clicks) * 10000).toFixed(2)) : 0;
    node.evr = clicks > 0 ? Number(((node.events / clicks) * 1000000).toFixed(2)) : 0;
    node.ecpc = clicks > 0 ? Number(((node.revenues / clicks) * 1000000).toFixed(2)) : 0;
};

// Recursive function to build tree from flat list
const buildTree = (
    data: any[],
    groups: string[],
    depth: number = 0,
    sortField: string = 'clicks',
    sortOrder: string = 'desc'
): any[] => {
    if (depth >= groups.length) {
        data.forEach(item => calculateRates(item));
        return data;
    }

    const currentGroupField = groups[depth];

    // Group data by current field
    const groupedMap = new Map<string, any[]>();

    data.forEach(item => {
        const key = item[currentGroupField] || 'Unknown';
        if (!groupedMap.has(key)) {
            groupedMap.set(key, []);
        }
        groupedMap.get(key)!.push(item);
    });

    const result: any[] = [];

    groupedMap.forEach((groupItems, key) => {
        const node: any = {
            key: `${depth}_${key}_${Math.random().toString(36).substr(2, 9)}`, // Unique key
            [currentGroupField]: key, // Store the group value
            groupValue: key, // Generic field for display in the 'Group' column
            groupField: currentGroupField,
            _depth: depth
        };

        // If this is the last grouping level, the items are leaves in our tree structure
        if (depth === groups.length - 1) {
            // Aggregate metrics for this "leaf" node from the groupItems
            METRIC_FIELDS.forEach(field => node[field] = 0);

            groupItems.forEach(item => {
                METRIC_FIELDS.forEach(field => node[field] += Number(item[field] || 0));
            });
            // No children for these nodes
        } else {
            // Parent level: Recursive build children
            node.children = buildTree(groupItems, groups, depth + 1, sortField, sortOrder);

            // Aggregate metrics from children
            METRIC_FIELDS.forEach(field => node[field] = 0);
            node.children.forEach((child: any) => {
                METRIC_FIELDS.forEach(field => node[field] += Number(child[field] || 0));
            });
        }

        calculateRates(node);
        result.push(node);
    });

    // Sort the current level nodes
    result.sort((a, b) => {
        const valA = a[sortField] || 0;
        const valB = b[sortField] || 0;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return result;
};

const DataTable: React.FC<DataTableProps> = ({ onFetch, filterParams }) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [rawData, setRawData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [groupBy, setGroupBy] = useState<string[]>([]);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
    const [sorter, setSorter] = useState<any>({ field: 'clicks', order: 'descend' });

    const fetchData = async () => {
        setLoading(true);
        try {
            const isGrouping = groupBy.length > 0;
            const pageSize = isGrouping ? 10000 : pagination.pageSize; // "Load All" logic for grouping
            const current = isGrouping ? 1 : pagination.current;

            const sortField = sorter.field || 'clicks';
            const sortOrder = sorter.order === 'ascend' ? 'asc' : 'desc';

            const queryParams = {
                ...filterParams,
                groupBy, // Send ALL groups
                page: current,
                pageSize,
                sortField,
                sortOrder
            };

            const result = await onFetch(queryParams);
            setRawData(result.data);

            if (isGrouping) {
                // Client-side tree construction with recursive sorting
                const treeData = buildTree(result.data, groupBy, 0, sortField, sortOrder);

                setData(treeData);
                setTotal(treeData.length); // Total root nodes
            } else {
                // Add unique keys for flat data
                const dataWithKeys = result.data.map((item: any, idx: number) => ({
                    ...item,
                    key: `flat_${idx}_${item.date || ''}_${item.geo || ''}_${item.app_id || ''}`
                }));
                setData(dataWithKeys);
                setTotal(result.total);
            }
        } finally {
            setLoading(false);
        }
    };

    // Initial load & Filter change
    useEffect(() => {
        fetchData();
    }, [filterParams, groupBy, pagination.current, pagination.pageSize, sorter]);

    const handleTableChange: TableProps<any>['onChange'] = (pagination, filters, sorter: any) => {
        setPagination(prev => ({
            ...prev,
            current: pagination.current || 1,
            pageSize: pagination.pageSize || 20
        }));
        setSorter(sorter);
    };

    const handleGroupChange = (values: string[]) => {
        if (values.length > 3) return;
        setGroupBy(values);
        setPagination(prev => ({ ...prev, current: 1 }));
    };

    const handleExport = () => {
        if (!rawData || rawData.length === 0) return;

        // Ensure metrics are calculated
        const dataToExport = rawData.map((item: any) => {
            const newItem = { ...item };
            calculateRates(newItem);
            return newItem;
        });

        // Determine CSV Headers
        // Base keys: grouping keys + metrics
        // If grouping is active, we might want to ensure those fields are present.
        // If not grouping, we just dump what we have.

        // Let's use a fixed set of convenient headers + dynamic group fields if present
        const exportFields = [
            ...groupBy, // current grouping fields
            ...METRIC_FIELDS,
            'cvr', 'evr', 'ecpc'
        ];

        // Add date if present in the first record?
        if (dataToExport[0] && 'date' in dataToExport[0]) {
            exportFields.unshift('date');
        }

        // Add name/other fields that might be relevant but aren't explicitly grouping keys? 
        // For simplicity, let's stick to the common fields + metrics. 
        // If the user needs more, we can refine.

        const csvContent = [
            exportFields.join(','), // Header
            ...dataToExport.map((row: any) => exportFields.map(field => {
                const val = row[field];
                return val !== undefined && val !== null ? val : '';
            }).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `data_export_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Columns Configuration
    let columns: any[] = [];

    if (groupBy.length > 0) {
        // Tree Mode Columns
        // First column is the Group Hierarchy
        columns.push({
            title: 'Group',
            key: 'group_key',
            width: 300,
            render: (text: any, record: any) => {
                // This displays the value for the current level
                return record.groupValue;
            }
        });
    } else {
        // Flat Mode - No Grouping
        // No specific 'Group' column, metrics will be directly shown
    }

    // Metric Columns
    const metricCols = [
        { title: 'Clicks', dataIndex: 'clicks', key: 'clicks', sorter: true },
        { title: 'Installs', dataIndex: 'installs', key: 'installs', sorter: true },
        { title: 'Events', dataIndex: 'events', key: 'events', sorter: true },
        { title: 'Revenues', dataIndex: 'revenues', key: 'revenues', sorter: true, render: (val: number) => val ? Number(val).toFixed(2) : '0.00' },
        { title: 'CVR (万分之)', dataIndex: 'cvr', key: 'cvr', sorter: true },
        { title: 'EVR (百万分之)', dataIndex: 'evr', key: 'evr', sorter: true },
        { title: 'ECPC (百万分之)', dataIndex: 'ecpc', key: 'ecpc', sorter: true },
    ];

    columns = [...columns, ...metricCols];

    return (
        <Card title="Detailed Report" style={{ marginTop: 24 }}>
            <Space style={{ marginBottom: 16 }}>
                <span>Group By (Max 3):</span>
                <Select
                    mode="multiple"
                    style={{ width: 400 }}
                    placeholder="Select grouping fields"
                    value={groupBy}
                    onChange={handleGroupChange}
                    maxCount={3}
                >
                    {GROUP_OPTIONS.map(opt => (
                        <Option key={opt} value={opt}>{opt}</Option>
                    ))}
                </Select>
                <Button onClick={handleExport} type="primary">Export CSV</Button>
            </Space>

            <Table
                rowKey="key"
                columns={columns}
                dataSource={data}
                loading={loading}
                pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    total,
                    showSizeChanger: true
                }}
                onChange={handleTableChange}
                scroll={{ x: 'max-content' }}
            // Removing expandable prop to avoid empty render and use default tree behavior
            />
        </Card>
    );
};

export default DataTable;
