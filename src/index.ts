import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt, Principal } from 'azle';
import { v4 as uuidv4 } from 'uuid';

type Medicine = Record<{
  creator: Principal;
  id: string;
  title: string;
  description: string;
  created_date: nat64;
  updated_at: Opt<nat64>;
  expiry_date: string;
  assigned_to: string;
  tags: Vec<string>;
  status: string;
  priority: string;
  comments: Vec<string>;
}>;

type MedicinePayload = Record<{
  title: string;
  description: string;
  assigned_to: string;
  expiry_date: string;
}>;

const MedicineStorage = new StableBTreeMap<string, Medicine>(0, 44, 512);

const initialLoadSize = 4;

$query
export function getInitialMedicines(): Result<Vec<Medicine>, string> {
  try {
    const initialMedicines = MedicineStorage.values().slice(0, initialLoadSize);
    return initialMedicines.length > 0
      ? Result.Ok(initialMedicines)
      : Result.Err("No initial medicines found");
  } catch (error) {
    return Result.Err("Failed to fetch initial medicines");
  }
}

$query
export function loadMoreMedicines(offset: number, limit: number): Result<Vec<Medicine>, string> {
  if (offset < 0 || limit < 0 || !Number.isInteger(offset) || !Number.isInteger(limit)) {
    return Result.Err("Invalid input parameters");
  }

  const allMedicines = MedicineStorage.values();
  const totalMedicines = allMedicines.length;

  if (totalMedicines === 0 || offset >= totalMedicines || offset + limit > totalMedicines) {
    return Result.Err("Invalid offset or limit");
  }

  const moreMedicines = allMedicines.slice(offset, offset + limit);
  return Result.Ok(moreMedicines);
}

$query
export function getMedicine(id: string): Result<Medicine, string> {
  if (!id) {
    return Result.Err('Invalid id parameter');
  }

  const medicine = MedicineStorage.get(id);

  return match(medicine, {
    Some: (med) => {
      if (med.creator.toString() !== ic.caller().toString()) {
        return Result.Err('You are not authorized to access Medicine');
      }
      return Result.Ok(med);
    },
    None: () => Result.Err(`Medicine with id:${id} not found`),
  });
}

$query
export function getMedicineByTags(tag: string): Result<Vec<Medicine>, string> {
  const relatedMedicine = MedicineStorage.values().filter((med) => med.tags.includes(tag));
  return Result.Ok(relatedMedicine);
}

$query
export function searchMedicines(searchInput: string): Result<Vec<Medicine>, string> {
  const lowerCaseSearchInput = searchInput.toLowerCase();
  try {
    const searchedMedicine = MedicineStorage.values().filter(
      (med) =>
        med.title.toLowerCase().includes(lowerCaseSearchInput) ||
        med.description.toLowerCase().includes(lowerCaseSearchInput)
    );
    return Result.Ok(searchedMedicine);
  } catch (err) {
    return Result.Err('Error finding the Medicine');
  }
}

$update
export function completedMedicine(id: string): Result<Medicine, string> {
  const medicine = MedicineStorage.get(id);

  return match(medicine, {
    Some: (med) => {
      if (!med.assigned_to) {
        return Result.Err('No one was assigned the Medicine');
      }
      const completeMedicine: Medicine = { ...med, status: 'Completed' };
      MedicineStorage.insert(med.id, completeMedicine);
      return Result.Ok(completeMedicine);
    },
    None: () => Result.Err(`Medicine with id:${id} not found`),
  });
}

$update
export function addMedicine(payload: MedicinePayload): Result<Medicine, string> {
  if (!payload.title || !payload.description || !payload.assigned_to || !payload.expiry_date) {
    return Result.Err('Missing or invalid input data');
  }

  const currentDate = new Date().toISOString();
  const expiryDate = new Date(payload.expiry_date).toISOString();

  if (expiryDate < currentDate) {
    return Result.Err('Expiry date cannot be in the past');
  }

  try {
    const newMedicine: Medicine = {
      creator: ic.caller(),
      id: uuidv4(),
      created_date: ic.time(),
      updated_at: Opt.None,
      tags: [],
      status: 'In Progress',
      priority: '',
      comments: [],
      title: payload.title,
      description: payload.description,
      assigned_to: payload.assigned_to,
      expiry_date: payload.expiry_date,
    };
    const insertResult = MedicineStorage.insert(newMedicine.id, newMedicine);
    return insertResult !== undefined
      ? Result.Ok(newMedicine)
      : Result.Err('Failed to insert medicine into storage');
  } catch (err) {
    return Result.Err('Issue encountered when Creating Medicine');
  }
}

$update
export function addTags(id: string, tags: Vec<string>): Result<Medicine, string> {
  if (!tags || tags.length === 0) {
    return Result.Err('Invalid tags');
  }

  const medicine = MedicineStorage.get(id);

  return match(medicine, {
    Some: (med) => {
      if (med.creator.toString() !== ic.caller().toString()) {
        return Result.Err('You are not authorized to access Medicine');
      }
      const updatedMedicine: Medicine = {
        ...med,
        tags: [...med.tags, ...tags],
        updated_at: Opt.Some(ic.time()),
      };
      MedicineStorage.insert(med.id, updatedMedicine);
      return Result.Ok(updatedMedicine);
    },
    None: () => Result.Err(`Medicine with id:${id} not found`),
  });
}

$update
export function updateMedicine(id: string, payload: MedicinePayload): Result<Medicine, string> {
  const medicine = MedicineStorage.get(id);

  return match(medicine, {
    Some: (med) => {
      if (med.creator.toString() !== ic.caller().toString()) {
        return Result.Err('You are not authorized to access Medicine');
      }
      const updatedMedicine: Medicine = { ...med, ...payload, updated_at: Opt.Some(ic.time()) };
      MedicineStorage.insert(med.id, updatedMedicine);
      return Result.Ok(updatedMedicine);
    },
    None: () => Result.Err(`Medicine with id:${id} not found`),
  });
}

$update
export function deleteMedicine(id: string): Result<Medicine, string> {
  const medicine = MedicineStorage.get(id);

  return match(medicine, {
    Some: (med) => {
      if (med.creator.toString() !== ic.caller().toString()) {
        return Result.Err('You are not authorized to access Medicine');
      }
      MedicineStorage.remove(id
);

      return Result.Ok(med);
    },
    None: () => Result.Err(`Medicine with id:${id} not found, could not be deleted`),
  });
}

$update
export function assignMedicine(id: string, assignedTo: string): Result<Medicine, string> {
  const medicine = MedicineStorage.get(id);

  return match(medicine, {
    Some: (med) => {
      if (med.creator.toString() !== ic.caller().toString()) {
        return Result.Err('You are not authorized to assign a Medicine');
      }
      const updatedMedicine: Medicine = { ...med, assigned_to: assignedTo };
      MedicineStorage.insert(med.id, updatedMedicine);
      return Result.Ok(updatedMedicine);
    },
    None: () => Result.Err(`Medicine with id:${id} not found`),
  });
}

$update
export function changeMedicineStatus(id: string, newStatus: string): Result<Medicine, string> {
  const medicine = MedicineStorage.get(id);

  return match(medicine, {
    Some: (med) => {
      if (med.creator.toString() !== ic.caller().toString()) {
        return Result.Err('You are not authorized to change the Medicine status');
      }
      const updatedMedicine: Medicine = { ...med, status: newStatus };
      MedicineStorage.insert(med.id, updatedMedicine);
      return Result.Ok(updatedMedicine);
    },
    None: () => Result.Err(`Medicine with id:${id} not found`),
  });
}

$query
export function getMedicinesByStatus(status: string): Result<Vec<Medicine>, string> {
  const medicinesByStatus = MedicineStorage.values().filter((med) => med.status === status);
  return Result.Ok(medicinesByStatus);
}

$update
export function setMedicinePriority(id: string, priority: string): Result<Medicine, string> {
  const medicine = MedicineStorage.get(id);

  return match(medicine, {
    Some: (med) => {
      if (med.creator.toString() !== ic.caller().toString()) {
        return Result.Err('You are not authorized to set Medicine priority');
      }
      const updatedMedicine: Medicine = { ...med, priority };
      MedicineStorage.insert(med.id, updatedMedicine);
      return Result.Ok(updatedMedicine);
    },
    None: () => Result.Err(`Medicine with id:${id} not found`),
  });
}

$update
export function sendDueDateReminder(id: string): Result<string, string> {
  const now = new Date().toISOString();
  const medicine = MedicineStorage.get(id);

  return match(medicine, {
    Some: (med) => {
      const medExpiryDate = new Date(med.expiry_date).toISOString();
      if (medExpiryDate < now && med.status !== 'Completed') {
        return Result.Ok('Medicine is overdue. Please complete it.');
      } else {
        return Result.Err('Medicine is not overdue or already completed.');
      }
    },
    None: () => Result.Err(`Medicine with id:${id} not found`),
  });
}

$query
export function getMedicinesByCreator(creator: Principal): Result<Vec<Medicine>, string> {
  const creatorMedicines = MedicineStorage.values().filter((med) => med.creator.toString() === creator.toString());
  return Result.Ok(creatorMedicines);
}

$query
export function getOverdueMedicines(): Result<Vec<Medicine>, string> {
  const now = new Date().toISOString();
  const overdueMedicines = MedicineStorage.values().filter(
    (med) => new Date(med.expiry_date).toISOString() < now && med.status !== 'Completed'
  );
  return Result.Ok(overdueMedicines);
}

$update
export function addMedicineComment(id: string, comment: string): Result<Medicine, string> {
  if (!id || comment === null) {
    return Result.Err(`Invalid id:${id} or comment`);
  }

  const medicine = MedicineStorage.get(id);

  return match(medicine, {
    Some: (med) => {
      const updatedComments = [...med.comments, comment];
      const updatedMedicine: Medicine = { ...med, comments: updatedComments };
      MedicineStorage.insert(med.id, updatedMedicine);
      return Result.Ok(updatedMedicine);
    },
    None: () => Result.Err(`Medicine with id:${id} not found`),
  });
}

// UUID workaround
globalThis.crypto = {
  // @ts-ignore
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};
```
