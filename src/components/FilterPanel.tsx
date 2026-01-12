'use client';

import React from 'react';
import { DatePicker, Select, Form, Button } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import debounce from 'lodash/debounce';

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

interface OptionValue {
    label: string;
    value: string;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ onSearch, initialValues }) => {
    const [form] = Form.useForm();

    // Generic fetcher for options
    const fetchOptions = async (field: string, search: string): Promise<OptionValue[]> => {
        const res = await fetch(`/api/meta?field=${field}&search=${encodeURIComponent(search)}`);
        const json = await res.json();
        return json.data || [];
    };

    const DebounceSelect = ({ field, placeholder, ...props }: any) => {
        const [options, setOptions] = React.useState<OptionValue[]>([]);
        const [fetching, setFetching] = React.useState(false);

        const loadOptions = React.useCallback(debounce(async (search: string) => {
            setFetching(true);
            const newOptions = await fetchOptions(field, search);
            setOptions(newOptions);
            setFetching(false);
        }, 500), [field]);

        React.useEffect(() => { loadOptions(''); }, [loadOptions]);

        return (
            <Select
                showSearch
                filterOption={false}
                onSearch={loadOptions}
                notFoundContent={fetching ? 'Loading...' : null}
                options={options}
                placeholder={placeholder}
                allowClear
                minInputLength={0}
                {...props}
            />
        );
    };

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
            <Form.Item name="geo" label="Geo" style={{ width: 150 }}>
                <DebounceSelect field="geo" placeholder="Geo" />
            </Form.Item>
            <Form.Item name="app_id" label="App ID" style={{ width: 300 }}>
                <DebounceSelect field="app_id" placeholder="App ID" />
            </Form.Item>
            <Form.Item name="os" label="OS" style={{ width: 150 }}>
                <DebounceSelect field="os" placeholder="OS" />
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
