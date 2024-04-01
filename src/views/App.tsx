import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import React, { useEffect, useState } from 'react';
import { Button, Icon, PortalProvider, SectionCard } from '@blueprintjs/core';
import toast, { Toaster } from 'react-hot-toast';
import { Channels } from '../models/channel';
import { IConfig, IPortForward, IProject } from '../models/IConfig';
import {
  IConfigWithStates,
  IPortForwardWithState,
  IProjectWithState,
  IState,
} from '../models/IState';
import SectionWithBackground from './components/SectionWithBackground';
import AddOrEditProject from './dialog/AddOrEditProject';
import AddOrEditPortForward from './dialog/AddOrEditPortForward';

const showError = (message: string) => {
  toast.error(message);
};

function Home() {
  const [configWithStates, setConfigWithStates] =
    useState<IConfigWithStates | null>(null);
  const [config, setConfig] = useState<IConfig | null>(null);
  const [forwardStates, setForwardStates] = useState<IState | null>(null);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [editPortForwardProject, setEditPortForwardProject] =
    useState<IProjectWithState | null>(null);
  const [editPortForwardOpen, setEditPortForwardOpen] = useState(false);
  const [editPortForward, setEditPortForward] = useState<IPortForward | null>(
    null,
  );
  const [editProject, setEditProject] = useState<IProjectWithState | null>(
    null,
  );
  const [createMode, setCreateMode] = useState(false);

  const createNewProject = () => {
    setEditProjectOpen(true);
    setEditProject(null);
    setCreateMode(true);
  };

  const createNewPortForward = (project: IProjectWithState) => {
    setEditPortForwardOpen(true);
    setEditPortForwardProject(project);
    setEditPortForward(null);
  };

  const showEditPortForward = (portForward: IPortForward, project: IProjectWithState) => {
    setEditPortForward(portForward);
    setEditPortForwardProject(project);
    setEditPortForwardOpen(true);
  };

  const showEditProject = (project: IProjectWithState) => {
    setEditProjectOpen(true);
    setEditProject(project);
    setCreateMode(false);
  };

  const updateConfig = (c: IConfig, s: IState) => {
    const newConfig: IConfigWithStates = { ...c } as IConfigWithStates;
    newConfig.projects = newConfig.projects.map((project: IProject) => {
      const newProject: IProjectWithState = { ...project } as IProjectWithState;
      newProject.portforwards = newProject.portforwards?.map(
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
      newProject.running = newProject?.portforwards?.some(
        (pf: IPortForwardWithState) => pf.running,
      );
      return newProject;
    });
    setConfigWithStates(newConfig);
  };

  useEffect(() => {
    if (window.electron) {
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
    }
    return () => {};
  }, []);

  useEffect(() => {
    if (config && forwardStates) {
      updateConfig(config, forwardStates);
    }
  }, [config, forwardStates]);

  return (
    <>
      {editPortForwardOpen && editPortForwardProject && (
        <AddOrEditPortForward
          onDelete={(portForward: IPortForward, project: IProject) => {
            window.electron.ipcRenderer.sendMessage(
              Channels.UPDATE_OR_CREATE_PROJECT,
              project,
            );
            setEditPortForward(null);
            setEditPortForwardProject(null);
            setEditPortForwardOpen(false);
          }}
          onSaved={(updatedPortForward: IPortForward, project: IProject) => {
            window.electron.ipcRenderer.sendMessage(
              Channels.UPDATE_OR_CREATE_PROJECT,
              project,
            );
            setEditPortForward(null);
            setEditPortForwardProject(null);
            setEditPortForwardOpen(false);
          }}
          isOpen
          createMode={editPortForward === null}
          onCancel={() => setEditPortForwardOpen(false)}
          project={editPortForwardProject}
          portForward={editPortForward}
        />
      )}
      {editProjectOpen && (
        <AddOrEditProject
          onDelete={(project: IProject) => {
            window.electron.ipcRenderer.sendMessage(
              Channels.DELETE_PROJECT,
              project,
            );
            setEditProjectOpen(false);
          }}
          onSaved={(updatedProject: IProject) => {
            window.electron.ipcRenderer.sendMessage(
              Channels.UPDATE_OR_CREATE_PROJECT,
              updatedProject,
            );
            setEditProjectOpen(false);
          }}
          isOpen
          createMode={createMode}
          onCancel={() => setEditProjectOpen(false)}
          project={editProject}
        />
      )}
      <div className="innerContainer">
        {!configWithStates && <p>Waiting for config...</p>}
        {configWithStates &&
          configWithStates.projects.map((project: IProjectWithState) => (
            <SectionWithBackground
              key={project.name}
              project={project}
              title={`${project.name}${
                project.stagingGroup ? ` - ${project.stagingGroup}` : ''
              } `}
              rightElement={
                <div>
                  {project.running ? (
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
                  )}
                  <Button
                    style={{ marginLeft: '5px' }}
                    loading={false}
                    disabled={project.running}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      showEditProject(project);
                      return false;
                    }}
                  >
                    <Icon icon="cog" color="gray" />
                  </Button>
                </div>
              }
            >
              <SectionCard>
                {project.portforwards?.map((pf: IPortForwardWithState) => {
                  const disabled = !project.running;
                  return (
                    <div key={pf.name} style={{
                      display: "flex",
                      padding: "5px 12px 5px 5px",
                    }}>
                      <div style={{flex: 0.9}}>
                        {pf.name} {pf.contextNamespace} - {pf.localPort}:
                        {pf.sourcePort}
                      </div>
                      <div style={{flex: 0.1}}>
                        {disabled && <a href={"#"}
                         onClick={() => {
                          showEditPortForward(pf, project);
                        }}>
                        <Icon
                          icon="cog"
                        />
                      </a>}
                      </div>
                    </div>
                  );
                })}
                <Button
                  intent="primary"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    createNewPortForward(project);
                    return false;
                  }}
                >
                  <Icon
                    icon="plus"
                    style={{ paddingRight: '10px', paddingLeft: '5px' }}
                  />{' '}
                  Create new Port Forward
                </Button>
              </SectionCard>
            </SectionWithBackground>
          ))}
        <Button onClick={() => createNewProject()} intent="primary">
          <Icon
            icon="plus"
            style={{ paddingRight: '10px', paddingLeft: '5px' }}
          />
          Add New Project
        </Button>
      </div>
    </>
  );
}

export default function App() {
  return (
    <PortalProvider portalClassName="my-custom-class">
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
        <Toaster />
      </Router>
    </PortalProvider>
  );
}
