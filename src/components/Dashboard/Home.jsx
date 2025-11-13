import Mesas from './Mesas.jsx';

function Home({ business }) {
  return (
    <div>
      {/* Gestión de mesas */}
      <Mesas businessId={business?.id} />
    </div>
  );
}

export default Home;
