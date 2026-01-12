'use client';

import React, { useState, useCallback } from 'react';
import { Layout, Typography, message } from 'antd';
import dayjs from 'dayjs';
import FilterPanel, { FilterValues } from '@/components/FilterPanel';
import TrendChart from '@/components/TrendChart';
import DataTable from '@/components/DataTable';

const { Header, Content } = Layout;
const { Title } = Typography;

export default function Home() {
  const [filterValues, setFilterValues] = useState<FilterValues>({
    dateRange: [dayjs().subtract(7, 'day'), dayjs().subtract(1, 'day')],
  });
  const [trendData, setTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);

  // Fetch Trend Data
  const fetchTrend = useCallback(async (filters: FilterValues) => {
    setTrendLoading(true);
    try {
      const [start, end] = filters.dateRange;
      const response = await fetch('/api/trend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: start.format('YYYY-MM-DD'),
          endDate: end.format('YYYY-MM-DD'),
          geo: filters.geo,
          app_id: filters.app_id,
          os: filters.os,
        }),
      });
      const result = await response.json();
      if (result.data) {
        setTrendData(result.data);
      }
    } catch (error) {
      message.error('Failed to load trend data');
    } finally {
      setTrendLoading(false);
    }
  }, []);

  // Fetch Report Data (passed to DataTable)
  const fetchReport = async (params: any) => {
    const { dateRange, ...rest } = params;
    const [start, end] = dateRange;

    const response = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: start.format('YYYY-MM-DD'),
        endDate: end.format('YYYY-MM-DD'),
        ...rest
      }),
    });
    return await response.json();
  };

  // Initial load
  React.useEffect(() => {
    fetchTrend(filterValues);
  }, []);

  const handleSearch = (values: FilterValues) => {
    setFilterValues(values);
    fetchTrend(values);
    // DataTable will auto-refetch because filterParams prop changes
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', background: '#001529' }}>
        <Title level={3} style={{ color: '#fff', margin: 0 }}>Doris Analytics Dashboard</Title>
      </Header>
      <Content style={{ padding: '24px 50px', background: '#f0f2f5' }}>
        <FilterPanel onSearch={handleSearch} initialValues={filterValues} />

        <TrendChart data={trendData} loading={trendLoading} />

        <DataTable
          onFetch={fetchReport}
          filterParams={filterValues}
        />
      </Content>
    </Layout>
  );
}
