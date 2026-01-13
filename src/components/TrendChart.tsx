'use client';

import dayjs from 'dayjs';

interface TrendChartProps {
    data: any[];
    loading?: boolean;
}

const TrendChart: React.FC<TrendChartProps> = ({ data, loading }) => {
    const getOption = () => {
        const dates = data.map(item => dayjs(item.dt).format('YYYY-MM-DD'));
        const clicks = data.map(item => item.clicks);
        const cvr = data.map(item => item.cvr);
        const evr = data.map(item => item.evr);
        const ecpc = data.map(item => item.ecpc);

        return {
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross',
                },
            },
            legend: {
                data: ['Clicks', 'CVR (万分之)', 'EVR (百万分之)', 'ECPC (百万分之)'],
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true,
            },
            xAxis: [
                {
                    type: 'category',
                    data: dates,
                    axisPointer: {
                        type: 'shadow',
                    },
                },
            ],
            yAxis: [
                {
                    type: 'value',
                    name: 'Clicks',
                    position: 'left',
                    axisLine: {
                        show: true,
                        lineStyle: {
                            color: '#5470C6',
                        },
                    },
                },
                {
                    type: 'value',
                    name: 'Rates',
                    position: 'right',
                    axisLine: {
                        show: true,
                        lineStyle: {
                            color: '#91CC75',
                        },
                    },
                    // Adjust labels or scale if needed
                },
            ],
            series: [
                {
                    name: 'Clicks',
                    type: 'bar',
                    data: clicks,
                },
                {
                    name: 'CVR (万分之)',
                    type: 'line',
                    yAxisIndex: 1,
                    data: cvr,
                },
                {
                    name: 'EVR (百万分之)',
                    type: 'line',
                    yAxisIndex: 1,
                    data: evr,
                },
                {
                    name: 'ECPC (百万分之)',
                    type: 'line',
                    yAxisIndex: 1,
                    data: ecpc,
                },
            ],
        };
    };

    return (
        <div style={{ background: '#fff', padding: 24, borderRadius: 8, marginBottom: 24 }}>
            <ReactECharts
                option={getOption()}
                notMerge={true}
                lazyUpdate={true}
                showLoading={loading}
                style={{ height: 400 }}
            />
        </div>
    );
};

export default TrendChart;
