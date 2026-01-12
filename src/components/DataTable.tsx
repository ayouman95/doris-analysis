'use client';

import React, { useState, useEffect } from 'react';
import { Table, Select, Space, Card } from 'antd';
import type { TableProps } from 'antd';

const { Option } = Select;

const GROUP_OPTIONS = [
    'geo', 'app_id', 'os', 'publisher', 'bundle', 'brand',
    'model', 'ad_type', 'bid_floor', 'osv'
];

const METRICS = ['clicks', 'installs', 'events', 'revenues', 'cvr', 'evr', 'ecpc'];
interface DataTableProps {
    onFetch: (params: any) => Promise<any>;
    filterParams: any; // from FilterPanel
}

// Helper to find a node and append children
const updateTreeData = (list: any[], key: string, children: any[]): any[] => {
    return list.map(node => {
        if (node.key === key) {
            return { ...node, children };
        }
        if (node.children) {
            return { ...node, children: updateTreeData(node.children, key, children) };
        }
        return node;
    });
};

const DataTable: React.FC<DataTableProps> = ({ onFetch, filterParams }) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [groupBy, setGroupBy] = useState<string[]>([]);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
    const [sorter, setSorter] = useState<any>({ field: 'clicks', order: 'descend' });
    const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);

    const fetchData = async (
        parentKey: string | null = null,
        parentFilters: any = {},
        currentLevelIndex: number = 0
    ) => {
        // If no grouping selected, just fetch flat (or treat as total)
        // If grouping selected, fetch the level at currentLevelIndex
        const targetGroup = groupBy[currentLevelIndex];

        // If we ran out of levels, stop
        if (groupBy.length > 0 && !targetGroup && parentKey !== null) return [];

        // For root (parentKey === null), use state loading. For children, table handles loading icon via promise? 
        // Antd table onExpand doesn't auto-show loading for async, we might need to handle it.
        // Actually, we can return null and update state.

        if (parentKey === null) setLoading(true);

        try {
            const { current, pageSize } = pagination;
            const sortField = sorter.field || 'clicks';
            const sortOrder = sorter.order === 'ascend' ? 'asc' : 'desc';

            // Construct filters: Base Filters + Filters from Parent Path
            const queryParams = {
                ...filterParams,
                ...parentFilters,
                groupBy: groupBy.length > 0 ? [targetGroup] : [], // Only group by the current level field
                page: parentKey === null ? current : 1, // Children usually don't page, or we hardcode page 1 big size
                pageSize: parentKey === null ? pageSize : 50, // Limit children size
                sortField,
                sortOrder
            };

            const result = await onFetch(queryParams);

            // Format result for Tree
            const nodes = result.data.map((item: any, index: number) => {
                const isLeaf = currentLevelIndex >= groupBy.length - 1;
                const itemValue = groupBy.length > 0 ? item[targetGroup] : 'Total';
                // Unique key: ParentKey_Value (to avoid collision)
                const uniqueKey = parentKey ? `${parentKey}_${itemValue}` : `${itemValue}_${index}`;

                return {
                    ...item,
                    key: uniqueKey,
                    // Store strict value for next query
                    _groupValue: itemValue,
                    _groupField: targetGroup,
                    _depth: currentLevelIndex,
                    // If not leaf, mark as expandable (Antd checks 'children' presence or expandable prop)
                    // We set 'children' to empty array if not leaf to show + icon, but that implies loaded.
                    // Instead, we use 'leaf' prop or rowExpandable?
                    // Antd Table: if record.children is undefined, it's a leaf. If it is [], it's an expanded but empty node?
                    // Actually, we can just use 'isLeaf' property if we use TreeData. But this is Table.
                    // We will manually manage onExpand.
                    isNodeLeaf: isLeaf
                };
            });

            if (parentKey === null) {
                setData(nodes);
                setTotal(result.total);
            } else {
                return nodes;
            }
        } finally {
            if (parentKey === null) setLoading(false);
        }
    };

    // Initial load & Root change
    useEffect(() => {
        setExpandedKeys([]); // Reset expansion on filter change
        fetchData(null, {}, 0);
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
        setExpandedKeys([]); // Reset expansion on group change
    };

    const handleExpand = async (expanded: boolean, record: any) => {
        if (expanded && (!record.children || record.children.length === 0) && !record.isNodeLeaf) {
            // Fetch children
            const nextDepth = record._depth + 1;

            // Construct filters from path. 
            // We need to know the 'path' of filters. 
            // Currently record only knows its immediate parent? 
            // Actually, we need to pass accumulated filters down.
            // Let's store 'accumulatedFilters' in the record.

            // Re-think: A simpler way is to just use 'record' which contains the values of all previous levels?
            // No, the record from API only contains the current group column and metrics.
            // So we MUST pass the filters down.

            const parentFilters = record._filters || {};
            const nextFilters = { ...parentFilters, [record._groupField]: record._groupValue };

            const children = await fetchData(record.key, nextFilters, nextDepth);

            // Inject accumulated filters into children so they can expand too
            const childrenWithFilters = children.map((child: any) => ({
                ...child,
                _filters: nextFilters
            }));

            setData(prev => updateTreeData(prev, record.key, childrenWithFilters));
        }

        setExpandedKeys(prev => expanded ? [...prev, record.key] : prev.filter(k => k !== record.key));
    };

    // Columns Configuration
    // If grouped: Show ONE column for the "Dimensions".
    // If not grouped: Show ?

    let columns: any[] = [];

    if (groupBy.length > 0) {
        columns.push({
            title: 'Group',
            key: 'group_key',
            render: (text: any, record: any) => {
                // Show the value of the current group field
                return record[record._groupField] || '-';
            }
        });
    } else {
        columns.push({ title: 'Total', dataIndex: 'total', render: () => 'All' });
    }

    columns = [
        ...columns,
        { title: 'Clicks', dataIndex: 'clicks', key: 'clicks', sorter: true },
        { title: 'Installs', dataIndex: 'installs', key: 'installs', sorter: true },
        { title: 'Events', dataIndex: 'events', key: 'events', sorter: true },
        { title: 'Revenues', dataIndex: 'revenues', key: 'revenues', sorter: true },
        { title: 'CVR (万分之)', dataIndex: 'cvr', key: 'cvr', sorter: true },
        { title: 'EVR (百万分之)', dataIndex: 'evr', key: 'evr', sorter: true },
        { title: 'ECPC (百万分之)', dataIndex: 'ecpc', key: 'ecpc', sorter: true },
    ];

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
                expandable={{
                    expandedRowRender: () => null, // We don't use nested row render, we use tree structure which Table supports natively if children exist
                    rowExpandable: (record) => !record.isNodeLeaf,
                    onExpand: handleExpand,
                    expandedRowKeys: expandedKeys,
                    // This is crucial: Antd Table treats records with 'children' as tree nodes.
                    // But we fetch lazily. So initially no children.
                    // We need to verify if Antd tries to render + icon only if children prop exists.
                    // It usually checks children && children.length > 0.
                    // To force show +, we might need `children: []` initially?
                    // Let's try setting children: [] (empty) if not leaf. NOTE: Antd might hide it if empty.
                    // UPDATE: Antd Table `onExpand` working with `rowExpandable` should show icon even if children missing? 
                    // No, usually needs children property.
                    // Let's workaround: Pre-fill children with empty array if not leaf? 
                    // Or better, check 'hasChildren' or similar?
                    // Actually, if we set children to `null` or `undefined`, it's a leaf.
                    // If we set to `[]`, it's an expanded node with no children.
                    // Let's try setting children: null for leaves, and children: [] for expandables?
                    // No, `children` property presence usually dictates tree mode.
                }}
            />
        </Card>
    );
};

export default DataTable;
