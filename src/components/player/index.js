import React, { useEffect, useMemo, useRef, useState } from 'react';
import cx from 'classnames';
import {
  defineMessages,
  useIntl,
} from 'react-intl';
import { shortcuts as config } from 'config';
import Application from './application';
import Content from './content';
import Media from './media';
import Modal from './modal';
import BottomBar from 'components/bars/bottom';
import TopBar from 'components/bars/top';
import {
  play,
  seek,
  skip,
} from 'utils/actions';
import { ID } from 'utils/constants';
import layout from 'utils/layout';
import Shortcuts from 'utils/shortcuts';
import telemetry from 'utils/telemetry';
import { useLayoutSwap } from 'components/utils/hooks';
import './index.scss';

const intlMessages = defineMessages({
  aria: {
    id: 'player.wrapper.aria',
    description: 'Aria label for the player wrapper',
  },
});

const toggle = (setter, name, key) => () => setter(prev => {
  telemetry.track(name, 'layout', { [key]: !prev });

  return !prev;
});

const Player = () => {
  const intl = useIntl();

  const [fullscreen, setFullscreen] = useState(false);
  const [modal, setModal] = useState('');
  const [search, setSearch] = useState([]);
  const [section, setSection] = useState(layout.section);
  const [swap, setSwap] = useState(layout.swap);

  const shortcuts = useRef();

  const toggles = useMemo(() => ({
    fullscreen: toggle(setFullscreen, 'fullscreen', 'layout.fullscreen'),
    section: toggle(setSection, 'toggle section', 'layout.section'),
    swap: toggle(setSwap, 'swap layout', 'layout.swapped'),
  }), []);

  const { showPresentation } = useLayoutSwap();
  const hidePresentation = showPresentation === false;

  useEffect(() => {
    if (showPresentation === false) {
      setSwap(true);
    } else {
      setSwap(false);
    }
  }, [showPresentation]);

  useEffect(() => {
    const { seconds } = config.seek;

    const actions = {
      fullscreen: toggles.fullscreen,
      play: () => play(),
      section: toggles.section,
      seek: {
        backward: () => seek(-seconds),
        forward: () => seek(+seconds),
      },
      skip: {
        next: () => skip(+1),
        previous: () => skip(-1),
      },
      swap: toggles.swap,
    };

    shortcuts.current = new Shortcuts(actions);

    return () => {
      if (shortcuts.current) shortcuts.current.destroy();
    };
  }, [toggles]);

  const style = {
    'fullscreen-content': fullscreen,
    'hidden-section': !section,
    'single-content': layout.single || hidePresentation,
  };

  return (
    <div
      aria-label={intl.formatMessage(intlMessages.aria)}
      className={cx('player-wrapper', style)}
      id={ID.PLAYER}
    >
      <TopBar
        openModal={(type) => setModal(type)}
        section={section}
        toggleSection={toggles.section}
        toggleSwap={toggles.swap}
        hidePresentation={hidePresentation}
      />
      <Media
        fullscreen={fullscreen}
        swap={swap}
        toggleFullscreen={toggles.fullscreen}
        hidePresentation={hidePresentation}
      />
      <Application />
      <Content
        fullscreen={fullscreen}
        handleSearch={(value) => setSearch(value)}
        search={search}
        swap={swap}
        toggleFullscreen={toggles.fullscreen}
        hidePresentation={hidePresentation}
      />
      <BottomBar />
      <Modal
        handleClose={() => setModal('')}
        handleSearch={(value) => setSearch(value)}
        modal={modal}
      />
    </div>
  );
};

export default Player;
