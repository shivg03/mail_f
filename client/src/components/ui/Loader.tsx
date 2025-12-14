import RingLoader from 'react-spinners/RingLoader';//DotLoader
import EnvelopeIcon from '../../../assets/icon-mail-n.svg';

const Loader = () => (
  <div className="flex flex-col items-center justify-center w-32 h-32 relative">
    {/* React Spinners RingLoader */}
    <div className="absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%, -50%)', zIndex: 0 }}>
      <RingLoader color="#ffa184" size={64} speedMultiplier={1} />
    </div>
    {/* Envelope Icon */}
    <div className="absolute left-1/2 top-1/2" style={{ transform: 'translate(-50%, -50%)', zIndex: 1 }}>
      <img src={EnvelopeIcon} alt="Envelope Loader" className="w-8 h-8" style={{ filter: 'invert(54%) sepia(80%) saturate(749%) hue-rotate(325deg) brightness(101%) contrast(101%)' }} />
    </div>
    {/* Loading Text */}
    <div className="mt-24 text-gray-500 font-semibold tracking-wide text-md">Loading Email…</div>
  </div>
);

export default Loader; 