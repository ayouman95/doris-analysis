'use client';

import React from 'react';
import { DatePicker, Input, Form, Button } from 'antd';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

export interface FilterValues {
    dateRange: [Dayjs, Dayjs];
    geo?: string;
    app_id?: string;
    os?: string;
}

interface FilterPanelProps {
    onSearch: (values: FilterValues) => void;
    initialValues?: FilterValues;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ onSearch, initialValues }) => {
    const [form] = Form.useForm();

    const handleFinish = (values: any) => {
        onSearch({
            dateRange: values.dateRange,
            geo: values.geo,
            app_id: values.app_id,
            os: values.os
        });
    };

    return (
        <Form
            form={form}
            layout="inline"
            onFinish={handleFinish}
            initialValues={{
                dateRange: [dayjs().subtract(7, 'day'), dayjs().subtract(1, 'day')],
                ...initialValues
            }}
            style={{ marginBottom: 24, padding: 24, background: '#fff', borderRadius: 8 }}
        >
            <Form.Item name="dateRange" label="Date Range" rules={[{ required: true }]}>
                <RangePicker />
            </Form.Item>
            <Form.Item name="geo" label="Geo">
                <Input placeholder="Geo Code" allowClear />
            </Form.Item>
            <Form.Item name="app_id" label="App ID">
                <Input placeholder="App ID" allowClear />
            </Form.Item>
            <Form.Item name="os" label="OS">
                <Input placeholder="OS" allowClear />
            </Form.Item>
            <Form.Item>
                <Button type="primary" htmlType="submit">
                    Search
                </Button>
            </Form.Item>
        </Form>
    );
};

export default FilterPanel;
