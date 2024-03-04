import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import React, { useEffect, useState } from 'react';
import { Button, Icon, SectionCard } from '@blueprintjs/core';
import toast, { Toaster } from 'react-hot-toast';
import { Channels } from '../models/channel';
import {
  IConfig,
  IPortForward,
  IProject,
} from '../models/IConfig';
import {
  IConfigWithStates,
  IPortForwardWithState,
  IProjectWithState,
  IState,
} from '../models/IState';
import SectionWithBackground from './components/SectionWithBackground';

const showError = (message: string) => {
  toast.error(message);
};

function Home() {
  const [configWithStates, setConfigWithStates] =
    useState<IConfigWithStates | null>(null);
  const [config, setConfig] = useState<IConfig | null>(null);
  const [forwardStates, setForwardStates] = useState<IState | null>(null);

  const updateConfig = (c: IConfig, s: IState) => {
    const newConfig: IConfigWithStates = { ...c } as IConfigWithStates;
    newConfig.projects = newConfig.projects.map((project: IProject) => {
      const newProject: IProjectWithState = { ...project } as IProjectWithState;
      newProject.portforwards = newProject.portforwards.map(
        (pf: IPortForward) => {
          const newPf: IPortForwardWithState = {
            ...pf,
          } as IPortForwardWithState;
          const state = s.activeForwards.find(
            (f) =>
              f.name === pf.name &&
              f.contextNamespace === pf.contextNamespace &&
              f.sourcePort === pf.sourcePort &&
              f.localPort === pf.localPort &&
              f.type === pf.type &&
              f.project === project.name,
          );
          if (state) {
            newPf.running = true;
            newPf.id = state.id;
          }
          return newPf;
        },
      );
      newProject.running = newProject.portforwards.some(
        (pf: IPortForwardWithState) => pf.running,
      );
      return newProject;
    });
    setConfigWithStates(newConfig);
  };

  useEffect(() => {
    // calling IPC exposed from preload script
    window.electron.ipcRenderer.on(Channels.CONFIG_CHANGED, (data: any) => {
      setConfig(data);
    });
    window.electron.ipcRenderer.on(Channels.SHOW_ERROR, (data: any) => {
      showError(data.message);
    });
    // calling IPC exposed from preload script
    window.electron.ipcRenderer.on(Channels.STATE_CHANGED, (data: any) => {
      setForwardStates(data);
    });

    window.electron.ipcRenderer.sendMessage(Channels.LOADED, []);
    // Clean the listener after the component is dismounted
    return () => {
      window.electron.ipcRenderer.removeAllListeners();
    };
  }, []);

  useEffect(() => {
    if (config && forwardStates) {
      updateConfig(config, forwardStates);
    }
  }, [config, forwardStates]);

  return (
    <div className="innerContainer">
      {!configWithStates && <p>Waiting for config...</p>}
      {configWithStates &&
        configWithStates.projects.map((project: IProjectWithState) => (
          <SectionWithBackground
            key={project.name}
            project={project}
            title={`${project.name}${
              project.stagingGroup ? ` - ${project.stagingGroup}` : ''
            } - ${project.contextName}`}
            rightElement={
              project.running ? (
                <Button
                  loading={false}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.electron.ipcRenderer.sendMessage(
                      Channels.STOP_PROJECT,
                      project,
                    );
                    return false;
                  }}
                >
                  <Icon icon="stop" color="red" />
                </Button>
              ) : (
                <Button
                  loading={false}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.electron.ipcRenderer.sendMessage(
                      Channels.START_PROJECT,
                      project,
                    );
                    return false;
                  }}
                >
                  <Icon icon="play" color="green" />
                </Button>
              )
            }
          >
            <SectionCard>
              {project.portforwards?.map((pf: IPortForwardWithState) => {
                return (
                  <div key={pf.name}>
                    <p>
                      {pf.name} {pf.contextNamespace} - {pf.localPort}:
                      {pf.sourcePort}
                    </p>
                  </div>
                );
              })}
            </SectionCard>
          </SectionWithBackground>
        ))}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
      <Toaster />
    </Router>
  );
}
