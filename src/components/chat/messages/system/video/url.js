import React from 'react';
import PropTypes from 'prop-types';
import { isEmpty } from 'utils/data/validators';
import Linkify from 'linkify-react';
import cx from 'classnames';
import telemetry from 'utils/telemetry';

const propTypes = {
  active: PropTypes.bool,
  url: PropTypes.string,
};

const defaultProps = {
  active: false,
  url: '',
};

export const domain = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

const Url = ({
  active,
  url,
}) => {
  if (isEmpty(url)) return null;

  const options = {
    className: cx('linkified', { inactive: !active }),
    target: '_blank',
    attributes: {
      onClick: () => telemetry.track('open video link', 'content', { 'video.domain': domain(url) }),
    },
  };

  return (
    <Linkify options={options}>
      {url}
    </Linkify>
  );
};

Url.propTypes = propTypes;
Url.defaultProps = defaultProps;

export default Url;
