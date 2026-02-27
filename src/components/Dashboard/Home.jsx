import Mesas from './Mesas.jsx';

function Home({ business, userRole = 'admin' }) {
  return (
    <div>
      {/* Gestión de mesas */}
      <Mesas businessId={business?.id} userRole={userRole} />
    </div>
  );
}

export default Home;
