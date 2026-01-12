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

const DataTable: React.FC<DataTableProps> = ({ onFetch, filterParams }) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [groupBy, setGroupBy] = useState<string[]>([]);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
    const [sorter, setSorter] = useState<any>({ field: 'clicks', order: 'descend' });

    const fetchData = async () => {
        setLoading(true);
        try {
            const { current, pageSize } = pagination;
            const sortField = sorter.field || 'clicks';
            const sortOrder = sorter.order === 'ascend' ? 'asc' : 'desc';

            const result = await onFetch({
                ...filterParams,
                groupBy,
                page: current,
                pageSize,
                sortField,
                sortOrder
            });

            setData(result.data);
            setTotal(result.total);
        } finally {
            setLoading(false);
        }
    };

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
        if (values.length > 3) return; // Limit to 3 (handled by maxTagCount or logic)
        setGroupBy(values);
        setPagination(prev => ({ ...prev, current: 1 })); // Reset to page 1 on group change
    };

    // Construct columns
    const columns = [
        ...groupBy.map(field => ({
            title: field.toUpperCase(),
            dataIndex: field,
            key: field,
        })),
        { title: 'Clicks', dataIndex: 'clicks', key: 'clicks', sorter: true },
        { title: 'Installs', dataIndex: 'installs', key: 'installs', sorter: true },
        { title: 'Events', dataIndex: 'events', key: 'events', sorter: true },
        { title: 'Revenues', dataIndex: 'revenues', key: 'revenues', sorter: true },
        { title: 'CVR (‱)', dataIndex: 'cvr', key: 'cvr', sorter: true },
        { title: 'EVR (ppm)', dataIndex: 'evr', key: 'evr', sorter: true },
        { title: 'ECPC (ppm)', dataIndex: 'ecpc', key: 'ecpc', sorter: true },
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
                rowKey={(record) => groupBy.map(g => record[g]).join('_') || 'total'}
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
            />
        </Card>
    );
};

export default DataTable;
