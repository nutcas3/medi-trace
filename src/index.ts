import { query, update, Record, StableBTreeMap, text, float64, Vec, match, Result, nat64, ic, Opt, Principal } from 'azle';
import { v4 as uuidv4 } from 'uuid';

const Medicine = Record({
  creator: Principal,
  id: Principal,
  title: text,
  description: text,
  created_date: float64,
  updated_at: float64,
  expiry_date: text,
  tags: text,
  status: text,
  comments: text,
});

type MedicinePayload = {
  title: string;
  description: string;
  assigned_to: string;
  expiry_date: string;
};

const MedicineStorage = StableBTreeMap(text, Medicine,(512))
//medicine to be loaded
const initialLoad = 6;

query
export function getInitialMedicines(): Result<Vec< typeof Medicine>, string> {
    const initialMedicines = MedicineStorage.values().slice(0, initialLoad);
    return Result.Ok(initialMedicines);
}
query
export function loadMoreMedicines(offset: number, limit: number): Result<Vec<typeof Medicine>, string> {
    const moreMedicines = MedicineStorage.values().slice(offset, offset + limit);
    return Result.Ok(moreMedicines);
}