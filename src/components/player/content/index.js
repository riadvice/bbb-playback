import React, { useEffect } from 'react';
import cx from 'classnames';
import Presentation from 'components/presentation';
import TldrawPresentation from 'components/tldraw';
import TldrawPresentationV2 from 'components/tldraw_v2';
import { getTldrawBbbVersion, isTldrawWhiteboard as isTldraw } from 'utils/tldraw';
import { useCurrentIndex, useCurrentInterval, useLayoutSwap } from 'components/utils/hooks';
import Screenshare from 'components/screenshare';
import Thumbnails from 'components/thumbnails';
import FullscreenButton from 'components/player/buttons/fullscreen';
import { LAYOUT } from 'utils/constants';
import { isEqual } from 'utils/data/validators';
import layout from 'utils/layout';
import storage from 'utils/data/storage';
import telemetry from 'utils/telemetry';
import './index.scss';
import { gte as semverGte } from 'semver';

// Every slide change, whichever whiteboard renders it
const SlideTelemetry = () => {
  const index = useCurrentIndex(storage.slides);

  useEffect(() => {
    if (index !== -1) telemetry.track('see slide', 'content', {
      'slide.number': index + 1,
      'slide.total': storage.slides.length,
    });
  }, [index]);

  return null;
};

const Content = ({
  fullscreen,
  handleSearch,
  search,
  swap,
  toggleFullscreen,
  hidePresentation,
}) => {
  const {
    index,
  } = useCurrentInterval(storage.tldraw);

  const { showScreenshare } = useLayoutSwap();

  if (layout.single || hidePresentation) return null;

  const isTldrawWhiteboard = isTldraw();

  let presentation;

  if (isTldrawWhiteboard) {
    const bbbVersion = getTldrawBbbVersion(index);

    if (bbbVersion && semverGte(bbbVersion, '3.0.0')) {
      presentation = <TldrawPresentationV2 />;
    }
    else {
      presentation = <TldrawPresentation />;
    }
  }
  else {
    presentation = <Presentation />;
  }

  return (
    <div className={cx('content', { 'swapped-content': swap })}>
      <FullscreenButton
        content={LAYOUT.CONTENT}
        fullscreen={fullscreen}
        swap={swap}
        toggleFullscreen={toggleFullscreen}
      />
      <div className="top-content">
        <SlideTelemetry />
        {presentation}
        {layout.screenshare ? (
          // video-js doesn't mount properly when not mounted in time
          <span style={!showScreenshare ? {
            display: 'none',
            width: '100%',
            height: '100%'
          } : {
            width: '100%',
            height: '100%',
          }}>
            <Screenshare />
          </span>
        ) : null}
      </div>
      <div className={cx('bottom-content', { 'inactive': fullscreen })}>
        <Thumbnails
          handleSearch={handleSearch}
          interactive
          search={search}
        />
      </div>
    </div>
  );
};

const areEqual = (prevProps, nextProps) => {
  if (prevProps.fullscreen !== nextProps.fullscreen) return false;

  if (prevProps.swap !== nextProps.swap) return false;

  if (prevProps.hidePresentation !== nextProps.hidePresentation) return false;

  if (!isEqual(prevProps.search, nextProps.search)) return false;

  return true;
};

export default React.memo(Content, areEqual);
