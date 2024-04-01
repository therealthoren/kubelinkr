import React, { useEffect, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { scaleSymlog } from 'd3-scale';
import { Icon } from '@blueprintjs/core';
import { IAllTrafficData, IProjectWithTrafficData } from '../../models/IConfig';
import { Channels } from '../../models/channel';
import { IProjectWithState } from '../../models/IState';

const scale = scaleSymlog();

export interface ISectionWithBackgroundProps {
  rightElement: React.ReactNode;
  title: React.ReactNode;
  // eslint-disable-next-line react/require-default-props
  children?: any;
  project: IProjectWithState;
}

function SectionWithBackground({
  rightElement,
  project,
  children,
  title,
}: ISectionWithBackgroundProps) {
  const [trafficData, setTrafficData] =
    useState<IProjectWithTrafficData | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    window.electron.ipcRenderer.on(
      Channels.TRAFFIC_DATA,
      // @ts-ignore
      (data: IAllTrafficData) => {
        const projectData =
          project.name in data && data[project.name] ? data[project.name] : {};
        // @ts-ignore
        setTrafficData(projectData);
      },
    );
  }, [project.name]);

  const collapseToggle = () => {
    setCollapsed(!collapsed);
  };

  return (
    <div
      key={`${project.name}-wrapper`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        marginBottom: '5px',
      }}
    >
      <div
        key={`${project.name}-section`}
        onClick={() => collapseToggle()}
        role="presentation"
        style={{
          display: 'flex',
          padding: '5px 12px 5px 5px',
          height: '50px',
          alignItems: 'center',
          background: 'white',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
      >
        <div style={{ flex: '0.6 1', fontWeight: 'bold' }}>{title}</div>
        <div
          style={{
            flex: '0.3 1',
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          <div style={{ flex: '1 1' }}>
            {trafficData && project.running && (
              <ResponsiveContainer width="100%" height={40}>
                <AreaChart
                  id={project.name}
                  key={project.name}
                  height={40}
                  data={trafficData.trafficDataEntriesPerSecond}
                >
                  <defs>
                    <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A74195" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#DF6185" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#DD5888" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#F1AC56" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis hide scale={scale} domain={['auto', 'auto']} />
                  <Area
                    isAnimationActive={false}
                    type="monotone"
                    opacity={0.8}
                    dataKey="bytes"
                    stroke="#8884d8"
                    fillOpacity={1}
                    fill="url(#colorUv)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div
          style={{
            flex: '0.2 1',
            paddingLeft: '4px',
            flexDirection: 'row',
            justifyContent: 'flex-end',
          }}
        >
          {rightElement}
        </div>
        <div style={{ flex: '0.05 1', paddingLeft: '8px' }}>
          {collapsed ? (
            <Icon icon="chevron-down" />
          ) : (
            <Icon icon="chevron-up" />
          )}
        </div>
      </div>
      <div
        style={{
          background: 'white',
          borderTop: '1px solid #e0e0e0',
          transition: 'max-height 0.5s ease-in-out 0s',
          overflow: 'hidden',
          maxHeight: collapsed ? '0px' : '400px',
        }}
      >
        <div style={{ padding: '5px 12px 5px 5px' }}>{children}</div>
      </div>
    </div>
  );
}

export default SectionWithBackground;
